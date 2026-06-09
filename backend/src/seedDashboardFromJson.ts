import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

type DashboardUiData = {
  generatedAt: string;
  crisisCards: Array<{
    id: string;
    label: string;
    type: string;
    severity: string;
    path: string;
    stats: Array<{ label: string; value: string; delta: string }>;
    icon: string;
  }>;
  govAlerts: Array<{
    type: string;
    severity: string;
    message: string;
    region: string;
    time: string;
  }>;
  incidentTrend: unknown[];
  riskSummary: unknown;
  publicHome: unknown;
  publicIncidents: unknown[];
  pastIncidents: unknown[];
  cybersecurity: unknown;
  recommendations: unknown[];
  publicSentiment: unknown;
  historicalCrises: unknown[];
};

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(dirname, '../data');

const uiData = await readJson<DashboardUiData>('dashboard-ui-data.json');
const externalData = await readJson<Record<string, unknown>>('dashboard-data.json');
const capturedAt = uiData.generatedAt ?? new Date().toISOString();

await pool.query('BEGIN');

try {
  const sourceId = await upsertSource({
    code: 'signal_json_seed',
    name: 'SiGnal backend JSON seed data',
    agency: 'SiGnal',
    sourceKind: 'manual',
    url: null,
  });

  await upsertSource({
    code: 'cached_external_dashboard_json',
    name: 'Cached external dashboard JSON',
    agency: 'data.gov.sg / SingStat',
    sourceKind: 'official_api',
    url: null,
  });

  await pool.query('TRUNCATE dashboard.map_layers RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE dashboard.alerts RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE dashboard.crises RESTART IDENTITY CASCADE');
  await pool.query('DELETE FROM dashboard.data_snapshots');

  for (const card of uiData.crisisCards) {
    await pool.query(
      `
        INSERT INTO dashboard.crises (name, crisis_type, status, severity, summary, started_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        card.label,
        toCrisisType(card.type),
        'resolved',
        toSeverity(card.severity),
        card.stats.map((stat) => `${stat.label}: ${stat.value}${stat.delta ? ` (${stat.delta})` : ''}`).join('; '),
        capturedAt,
      ],
    );
  }

  for (const alert of uiData.govAlerts) {
    await pool.query(
      `
        INSERT INTO dashboard.alerts (title, message, crisis_type, severity, region, source_kind, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'manual', 'resolved', $6)
      `,
      [
        alert.message,
        alert.message,
        toCrisisType(alert.type),
        toSeverity(alert.severity),
        alert.region,
        capturedAt,
      ],
    );
  }

  await insertSnapshot(sourceId, 'general', 'dashboard_overview', {
    crisisCards: uiData.crisisCards,
    incidentTrend: uiData.incidentTrend,
    riskSummary: uiData.riskSummary,
  });
  await insertSnapshot(sourceId, 'general', 'dashboard_public_home', uiData.publicHome);
  await insertSnapshot(sourceId, 'general', 'dashboard_public_incidents', {
    incidents: uiData.publicIncidents,
    pastIncidents: uiData.pastIncidents,
  });
  await insertSnapshot(sourceId, 'cybersecurity', 'dashboard_cybersecurity', uiData.cybersecurity);
  await insertSnapshot(sourceId, 'general', 'dashboard_recommendations', { items: uiData.recommendations });
  await insertSnapshot(sourceId, 'public_sentiment', 'dashboard_sentiment', uiData.publicSentiment);
  await insertSnapshot(sourceId, 'general', 'dashboard_historical', { items: uiData.historicalCrises });
  await insertSnapshot(sourceId, 'general', 'dashboard_cached_external', externalData);

  await pool.query(
    `
      INSERT INTO dashboard.map_layers (layer_key, title, payload, generated_at)
      VALUES ($1, $2, $3, $4)
    `,
    [
      'crises',
      'Seeded crisis hotspot layer',
      {
        markers: [
          {
            id: 'flood-orchard',
            name: 'Orchard Road',
            latitude: 1.3048,
            longitude: 103.8318,
            value: '3 reports',
            detail: 'Flooding reports in the last 30 minutes',
            severity: 'critical',
          },
          {
            id: 'dengue-bedok',
            name: 'Bedok North Ave 1',
            latitude: 1.3321,
            longitude: 103.936,
            value: '23 cases',
            detail: 'Dengue red zone under monitoring',
            severity: 'high',
          },
          {
            id: 'supply-jurong',
            name: 'Jurong Point',
            latitude: 1.3397,
            longitude: 103.7067,
            value: '4 outlets',
            detail: 'Medicine shortage reports clustered near Jurong Point',
            severity: 'medium',
          },
        ],
      },
      capturedAt,
    ],
  );

  await pool.query('COMMIT');
  console.log('Seeded dashboard data from backend/data JSON files.');
} catch (error) {
  await pool.query('ROLLBACK');
  throw error;
} finally {
  await pool.end();
}

async function readJson<T>(filename: string): Promise<T> {
  const contents = await readFile(path.join(dataDir, filename), 'utf8');
  return JSON.parse(contents) as T;
}

async function upsertSource(input: {
  code: string;
  name: string;
  agency: string;
  sourceKind: string;
  url: string | null;
}) {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO dashboard.data_sources (code, name, agency, source_kind, url)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (code)
      DO UPDATE SET name = EXCLUDED.name, agency = EXCLUDED.agency, source_kind = EXCLUDED.source_kind, url = EXCLUDED.url
      RETURNING id
    `,
    [input.code, input.name, input.agency, input.sourceKind, input.url],
  );

  return result.rows[0].id;
}

async function insertSnapshot(sourceId: string, crisisType: string, snapshotKey: string, payload: unknown) {
  await pool.query(
    `
      INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (source_id, snapshot_key, captured_at)
      DO UPDATE SET payload = EXCLUDED.payload
    `,
    [sourceId, crisisType, snapshotKey, capturedAt, payload],
  );
}

function toCrisisType(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('health')) return 'health';
  if (normalized.includes('weather')) return 'weather';
  if (normalized.includes('supply')) return 'supply_chain';
  if (normalized.includes('infrastructure')) return 'infrastructure';
  if (normalized.includes('cyber')) return 'cybersecurity';
  if (normalized.includes('sentiment')) return 'public_sentiment';
  return 'general';
}

function toSeverity(value: string) {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'medium';
}
