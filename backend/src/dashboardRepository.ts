import { query } from './db.js';

export type CrisisRow = {
  id: string;
  name: string;
  crisis_type: string;
  status: string;
  severity: string;
  summary: string | null;
  started_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AlertRow = {
  id: string;
  title: string;
  message: string;
  crisis_type: string;
  severity: string;
  region: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

export async function listCrises(filters: { status?: string; crisisType?: string }) {
  const clauses: string[] = [];
  const values: string[] = [];

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }

  if (filters.crisisType) {
    values.push(filters.crisisType);
    clauses.push(`crisis_type = $${values.length}`);
  }

  return query<CrisisRow>(
    `
      SELECT id, name, crisis_type, status, severity, summary, started_at, resolved_at, created_at, updated_at
      FROM dashboard.crises
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        created_at DESC
    `,
    values,
  );
}

export async function listAlerts(filters: { status?: string; crisisType?: string; region?: string }) {
  const clauses: string[] = [];
  const values: string[] = [];

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }

  if (filters.crisisType) {
    values.push(filters.crisisType);
    clauses.push(`crisis_type = $${values.length}`);
  }

  if (filters.region) {
    values.push(`%${filters.region}%`);
    clauses.push(`region ILIKE $${values.length}`);
  }

  return query<AlertRow>(
    `
      SELECT id, title, message, crisis_type, severity, region, status, created_at, resolved_at
      FROM dashboard.alerts
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY created_at DESC
    `,
    values,
  );
}

export async function getLatestSnapshot<T>(snapshotKey: string): Promise<T | null> {
  const rows = await query<{ payload: T }>(
    `
      SELECT payload
      FROM dashboard.data_snapshots
      WHERE snapshot_key = $1
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    [snapshotKey],
  );

  return rows[0]?.payload ?? null;
}

export async function getLatestMapLayer(layerKey: string) {
  const rows = await query<{ layer_key: string; title: string; payload: unknown; generated_at: string }>(
    `
      SELECT layer_key, title, payload, generated_at
      FROM dashboard.map_layers
      WHERE layer_key = $1
      ORDER BY generated_at DESC
      LIMIT 1
    `,
    [layerKey],
  );

  return rows[0] ?? null;
}

