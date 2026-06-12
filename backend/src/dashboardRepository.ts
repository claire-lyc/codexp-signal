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

const defaultCrises: CrisisRow[] = [
  {
    id: 'seed-crisis-covid',
    name: 'Covid-19',
    crisis_type: 'health',
    status: 'active',
    severity: 'medium',
    summary: 'Active cases today: 378; ICU occupancy: 25.',
    started_at: '2026-06-05T06:50:00+08:00',
    resolved_at: null,
    created_at: '2026-06-05T06:50:00+08:00',
    updated_at: '2026-06-05T06:50:00+08:00',
  },
  {
    id: 'seed-crisis-dengue',
    name: 'Dengue',
    crisis_type: 'health',
    status: 'active',
    severity: 'high',
    summary: 'Red zone clusters: 14; cases this week: 212.',
    started_at: '2026-06-05T09:45:00+08:00',
    resolved_at: null,
    created_at: '2026-06-05T09:45:00+08:00',
    updated_at: '2026-06-05T09:45:00+08:00',
  },
  {
    id: 'seed-crisis-flood',
    name: 'Flash Flood Risk',
    crisis_type: 'weather',
    status: 'active',
    severity: 'high',
    summary: 'High-risk zones: 6; peak rainfall (1h): 45mm.',
    started_at: '2026-06-05T10:23:00+08:00',
    resolved_at: null,
    created_at: '2026-06-05T10:23:00+08:00',
    updated_at: '2026-06-05T10:23:00+08:00',
  },
  {
    id: 'seed-crisis-panadol',
    name: 'Panadol Shortage',
    crisis_type: 'supply_chain',
    status: 'active',
    severity: 'medium',
    summary: 'Affected outlets: 87; estimated restock: 4 days.',
    started_at: '2026-06-05T08:30:00+08:00',
    resolved_at: null,
    created_at: '2026-06-05T08:30:00+08:00',
    updated_at: '2026-06-05T08:30:00+08:00',
  },
  {
    id: 'seed-crisis-cyber',
    name: 'Cyber Incident',
    crisis_type: 'cybersecurity',
    status: 'active',
    severity: 'low',
    summary: 'Active threats: 3.',
    started_at: '2026-06-05T07:15:00+08:00',
    resolved_at: null,
    created_at: '2026-06-05T07:15:00+08:00',
    updated_at: '2026-06-05T07:15:00+08:00',
  },
];

const defaultAlerts: AlertRow[] = [
  {
    id: 'seed-alert-flood',
    title: 'Flash flood risk in Orchard & East Coast',
    message: 'Flash flood risk in Orchard & East Coast',
    crisis_type: 'weather',
    severity: 'high',
    region: 'East/Central',
    status: 'active',
    created_at: '2026-06-05T10:23:00+08:00',
    resolved_at: null,
  },
  {
    id: 'seed-alert-dengue',
    title: 'New dengue red zone: Bedok North Ave 1',
    message: 'New dengue red zone: Bedok North Ave 1',
    crisis_type: 'health',
    severity: 'high',
    region: 'East',
    status: 'active',
    created_at: '2026-06-05T09:45:00+08:00',
    resolved_at: null,
  },
  {
    id: 'seed-alert-panadol',
    title: 'Panadol Menstrual out-of-stock at 87 outlets',
    message: 'Panadol Menstrual out-of-stock at 87 outlets',
    crisis_type: 'supply_chain',
    severity: 'medium',
    region: 'Nationwide',
    status: 'active',
    created_at: '2026-06-05T08:30:00+08:00',
    resolved_at: null,
  },
  {
    id: 'seed-alert-power',
    title: 'Power grid fluctuation in Woodlands',
    message: 'Power grid fluctuation in Woodlands',
    crisis_type: 'infrastructure',
    severity: 'medium',
    region: 'North',
    status: 'active',
    created_at: '2026-06-05T07:15:00+08:00',
    resolved_at: null,
  },
  {
    id: 'seed-alert-covid',
    title: 'New Covid-19 cluster at Jurong West MRT',
    message: 'New Covid-19 cluster at Jurong West MRT',
    crisis_type: 'health',
    severity: 'medium',
    region: 'West',
    status: 'active',
    created_at: '2026-06-05T06:50:00+08:00',
    resolved_at: null,
  },
];

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

  const rows = await query<CrisisRow>(
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
  return mergeCrisisRows(rows, filters);
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

  const rows = await query<AlertRow>(
    `
      SELECT id, title, message, crisis_type, severity, region, status, created_at, resolved_at
      FROM dashboard.alerts
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY created_at DESC
    `,
    values,
  );
  return mergeAlertRows(rows, filters);
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

function mergeCrisisRows(rows: CrisisRow[], filters: { status?: string; crisisType?: string }) {
  const baseline = defaultCrises.filter((item) => {
    const statusMatch = !filters.status || item.status === filters.status;
    const typeMatch = !filters.crisisType || item.crisis_type === filters.crisisType;
    return statusMatch && typeMatch;
  });
  const seen = new Set(rows.map((row) => row.name.toLowerCase()));
  return [...rows, ...baseline.filter((item) => !seen.has(item.name.toLowerCase()))];
}

function mergeAlertRows(rows: AlertRow[], filters: { status?: string; crisisType?: string; region?: string }) {
  const baseline = defaultAlerts.filter((item) => {
    const statusMatch = !filters.status || item.status === filters.status;
    const typeMatch = !filters.crisisType || item.crisis_type === filters.crisisType;
    const regionMatch = !filters.region || (item.region ?? '').toLowerCase().includes(filters.region.toLowerCase());
    return statusMatch && typeMatch && regionMatch;
  });
  const seen = new Set(rows.map((row) => row.title.toLowerCase()));
  return [...rows, ...baseline.filter((item) => !seen.has(item.title.toLowerCase()))];
}
