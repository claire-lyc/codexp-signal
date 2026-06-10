import { randomUUID } from 'node:crypto';
import { pool, query } from './db.js';

export type StoredVolunteerProfile = {
  user_id: string;
  profile: Record<string, unknown>;
  updated_at: string;
};

type StoredUrgentVolunteerAlert = {
  id: string;
  title: string;
  message: string;
  location: string;
  target_address: string | null;
  region: string;
  radius_km: number | null;
  agency: string;
  needed_count: number;
  status: 'active' | 'resolved';
  created_at: string;
  updated_at: string;
};

type StoredUrgentVolunteerResponse = {
  alert_id: string;
  volunteer_user_id: string;
  volunteer_profile_id: string;
  volunteer_name: string;
  volunteer_phone: string;
  volunteer_email: string;
  volunteer_region: string;
  volunteer_skills: string[];
  accepted_at: string;
};

export type UrgentVolunteerAlertResponder = {
  volunteerId: string;
  name: string;
  phone: string;
  email: string;
  region: string;
  skills: string[];
  acceptedAt: string;
};

export type UrgentVolunteerAlert = {
  id: string;
  title: string;
  message: string;
  location: string;
  targetAddress: string;
  region: string;
  radiusKm: number;
  agency: string;
  needed: number;
  status: 'active' | 'resolved';
  createdAt: string;
  acceptedCount: number;
  responded: boolean;
  responders: UrgentVolunteerAlertResponder[];
};

let schemaReady: Promise<void> | null = null;

async function ensureVolunteerSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS citizen.volunteer_profiles (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            profile JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS citizen.volunteer_urgent_alerts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            location TEXT NOT NULL,
            target_address TEXT,
            region TEXT NOT NULL,
            radius_km INTEGER,
            agency TEXT NOT NULL,
            needed_count INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await client.query(`ALTER TABLE citizen.volunteer_urgent_alerts ADD COLUMN IF NOT EXISTS target_address TEXT`);
        await client.query(`ALTER TABLE citizen.volunteer_urgent_alerts ADD COLUMN IF NOT EXISTS radius_km INTEGER`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS citizen.volunteer_urgent_alert_responses (
            alert_id TEXT NOT NULL REFERENCES citizen.volunteer_urgent_alerts(id) ON DELETE CASCADE,
            volunteer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            volunteer_profile_id TEXT NOT NULL,
            volunteer_name TEXT NOT NULL,
            volunteer_phone TEXT NOT NULL,
            volunteer_email TEXT NOT NULL,
            volunteer_region TEXT NOT NULL,
            volunteer_skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
            accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (alert_id, volunteer_user_id)
          )
        `);
      } finally {
        client.release();
      }
    })();
  }

  await schemaReady;
}

export async function getVolunteerProfile(userId: string) {
  await ensureVolunteerSchema();
  const rows = await query<StoredVolunteerProfile>(
    `
      SELECT user_id, profile, updated_at
      FROM citizen.volunteer_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return rows[0] ?? null;
}

export async function listVolunteerProfiles() {
  await ensureVolunteerSchema();
  return query<StoredVolunteerProfile>(
    `
      SELECT user_id, profile, updated_at
      FROM citizen.volunteer_profiles
      ORDER BY updated_at DESC
    `,
  );
}

export async function upsertVolunteerProfile(userId: string, profile: Record<string, unknown>) {
  await ensureVolunteerSchema();
  const rows = await query<StoredVolunteerProfile>(
    `
      INSERT INTO citizen.volunteer_profiles (user_id, profile, updated_at)
      VALUES ($1, $2::jsonb, now())
      ON CONFLICT (user_id)
      DO UPDATE SET profile = EXCLUDED.profile, updated_at = now()
      RETURNING user_id, profile, updated_at
    `,
    [userId, JSON.stringify(profile)],
  );
  return rows[0] ?? null;
}

export async function patchVolunteerProfile(userId: string, patch: Record<string, unknown>) {
  const existing = await getVolunteerProfile(userId);
  const current = (existing?.profile ?? {}) as Record<string, unknown>;
  return upsertVolunteerProfile(userId, { ...current, ...patch });
}

export async function createUrgentVolunteerAlert(input: {
  title: string;
  message: string;
  location: string;
  targetAddress: string;
  region: string;
  radiusKm: number;
  agency: string;
  needed: number;
}) {
  await ensureVolunteerSchema();
  const rows = await query<StoredUrgentVolunteerAlert>(
    `
      INSERT INTO citizen.volunteer_urgent_alerts (
        id,
        title,
        message,
        location,
        target_address,
        region,
        radius_km,
        agency,
        needed_count,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', now(), now())
      RETURNING id, title, message, location, target_address, region, radius_km, agency, needed_count, status, created_at, updated_at
    `,
    [randomUUID(), input.title, input.message, input.location, input.targetAddress, input.region, Math.max(1, input.radiusKm), input.agency, Math.max(1, input.needed)],
  );
  return hydrateUrgentAlerts(rows, null).then((alerts) => alerts[0] ?? null);
}

export async function listUrgentVolunteerAlerts() {
  await ensureVolunteerSchema();
  const rows = await query<StoredUrgentVolunteerAlert>(
    `
      SELECT id, title, message, location, target_address, region, radius_km, agency, needed_count, status, created_at, updated_at
      FROM citizen.volunteer_urgent_alerts
      ORDER BY
        CASE status WHEN 'active' THEN 0 ELSE 1 END,
        created_at DESC
    `,
  );
  return hydrateUrgentAlerts(rows, null);
}

export async function listUrgentVolunteerAlertsForVolunteer(userId: string) {
  await ensureVolunteerSchema();
  const item = await getVolunteerProfile(userId);
  const region = typeof item?.profile?.region === 'string' ? item.profile.region : null;

  const rows = await query<StoredUrgentVolunteerAlert>(
    `
      SELECT id, title, message, location, target_address, region, radius_km, agency, needed_count, status, created_at, updated_at
      FROM citizen.volunteer_urgent_alerts
      WHERE status = 'active'
        AND (
          $1::text IS NULL
          OR $1 = 'Any Region'
          OR region = $1
          OR region = 'Islandwide'
        )
      ORDER BY created_at DESC
    `,
    [region],
  );
  return hydrateUrgentAlerts(rows, userId);
}

export async function acceptUrgentVolunteerAlert(alertId: string, userId: string) {
  await ensureVolunteerSchema();
  const alert = await query<StoredUrgentVolunteerAlert>(
    `
      SELECT id, title, message, location, target_address, region, radius_km, agency, needed_count, status, created_at, updated_at
      FROM citizen.volunteer_urgent_alerts
      WHERE id = $1
      LIMIT 1
    `,
    [alertId],
  );

  if (!alert[0] || alert[0].status !== 'active') {
    return null;
  }

  const profileRecord = await getVolunteerProfile(userId);
  const profile = (profileRecord?.profile ?? {}) as Record<string, unknown>;
  const profileId = typeof profile.id === 'string' ? profile.id : userId;
  const name = typeof profile.name === 'string' && profile.name.trim() ? profile.name.trim() : 'Volunteer';
  const phone = typeof profile.phone === 'string' ? profile.phone : '';
  const email = typeof profile.email === 'string' ? profile.email : '';
  const region = typeof profile.region === 'string' ? profile.region : 'Unknown';
  const skills = Array.isArray(profile.skills) ? profile.skills.filter((skill): skill is string => typeof skill === 'string') : [];

  if (!phone) {
    throw new Error('Volunteer profile must include a phone number before accepting urgent alerts.');
  }

  await query(
    `
      INSERT INTO citizen.volunteer_urgent_alert_responses (
        alert_id,
        volunteer_user_id,
        volunteer_profile_id,
        volunteer_name,
        volunteer_phone,
        volunteer_email,
        volunteer_region,
        volunteer_skills,
        accepted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], now())
      ON CONFLICT (alert_id, volunteer_user_id)
      DO NOTHING
    `,
    [alertId, userId, profileId, name, phone, email, region, skills],
  );

  return getUrgentVolunteerAlertById(alertId, userId);
}

async function getUrgentVolunteerAlertById(alertId: string, userId: string | null) {
  const rows = await query<StoredUrgentVolunteerAlert>(
    `
      SELECT id, title, message, location, target_address, region, radius_km, agency, needed_count, status, created_at, updated_at
      FROM citizen.volunteer_urgent_alerts
      WHERE id = $1
      LIMIT 1
    `,
    [alertId],
  );
  const alerts = await hydrateUrgentAlerts(rows, userId);
  return alerts[0] ?? null;
}

async function hydrateUrgentAlerts(rows: StoredUrgentVolunteerAlert[], currentUserId: string | null) {
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const responses = await query<StoredUrgentVolunteerResponse>(
    `
      SELECT
        alert_id,
        volunteer_user_id,
        volunteer_profile_id,
        volunteer_name,
        volunteer_phone,
        volunteer_email,
        volunteer_region,
        volunteer_skills,
        accepted_at
      FROM citizen.volunteer_urgent_alert_responses
      WHERE alert_id = ANY($1::text[])
      ORDER BY accepted_at ASC
    `,
    [ids],
  );

  return rows.map((row) => {
    const responders = responses
      .filter((response) => response.alert_id === row.id)
      .map((response) => ({
        volunteerId: response.volunteer_profile_id,
        name: response.volunteer_name,
        phone: response.volunteer_phone,
        email: response.volunteer_email,
        region: response.volunteer_region,
        skills: response.volunteer_skills,
        acceptedAt: response.accepted_at,
      }));

    return {
      id: row.id,
      title: row.title,
      message: row.message,
      location: row.location,
      targetAddress: row.target_address ?? row.location,
      region: row.region,
      radiusKm: row.radius_km ?? 5,
      agency: row.agency,
      needed: row.needed_count,
      status: row.status,
      createdAt: row.created_at,
      acceptedCount: responders.length,
      responded: currentUserId ? responses.some((response) => response.alert_id === row.id && response.volunteer_user_id === currentUserId) : false,
      responders,
    } satisfies UrgentVolunteerAlert;
  });
}
