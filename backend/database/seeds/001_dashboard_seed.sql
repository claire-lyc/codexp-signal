INSERT INTO dashboard.data_sources (code, name, agency, source_kind, url, refresh_interval_seconds)
VALUES
  ('signal_ui_seed', 'SiGnal dashboard seed data', 'SiGnal', 'manual', NULL, NULL),
  ('data_gov_sg_weather', 'data.gov.sg weather readings', 'NEA', 'official_api', 'https://data.gov.sg/collections/1459/view', 900),
  ('data_gov_sg_dengue', 'NEA dengue clusters and MOH infectious disease records', 'NEA / MOH', 'official_api', 'https://data.gov.sg/datasets/d_dbfabf16158d1b0e1c420627c0819168/view', 86400)
ON CONFLICT (code) DO NOTHING;

INSERT INTO dashboard.crises (name, crisis_type, status, severity, summary, started_at)
VALUES
  ('Covid-19', 'health', 'resolved', 'medium', 'Archived case monitoring and ICU capacity tracking scenario.', '2026-06-05T06:50:00+08:00'),
  ('Dengue', 'health', 'resolved', 'high', 'Archived red zone cluster scenario in the East region.', '2026-06-05T09:45:00+08:00'),
  ('Flash Flood Risk', 'weather', 'resolved', 'high', 'Archived heavy rain report scenario around Central and East regions.', '2026-06-05T10:23:00+08:00'),
  ('Panadol Shortage', 'supply_chain', 'resolved', 'medium', 'Archived medicine shortage scenario across retail outlets.', '2026-06-05T08:30:00+08:00'),
  ('Cyber Incident', 'cybersecurity', 'resolved', 'low', 'Archived cyber threat monitoring scenario.', '2026-06-05T07:15:00+08:00');

INSERT INTO dashboard.alerts (title, message, crisis_type, severity, region, source_kind, status, created_at)
VALUES
  ('Flash flood risk in Orchard and East Coast', 'Water levels rising at Orchard Road underpass. Avoid the area and use alternate routes.', 'weather', 'critical', 'Central, East', 'manual', 'resolved', '2026-06-05T14:30:00+08:00'),
  ('New dengue red zone at Bedok North Ave 1', 'NEA fogging operations underway after confirmed cluster growth.', 'health', 'high', 'East', 'manual', 'resolved', '2026-06-05T13:00:00+08:00'),
  ('Panadol Menstrual shortage islandwide', 'Alternate suppliers contacted. Estimated restock within 4 days.', 'supply_chain', 'medium', 'Nationwide', 'manual', 'resolved', '2026-06-05T09:45:00+08:00'),
  ('Air quality advisory at unhealthy levels', 'PSI at 156. Vulnerable groups should avoid prolonged outdoor activity.', 'weather', 'medium', 'Nationwide', 'manual', 'resolved', '2026-06-05T06:30:00+08:00'),
  ('MRT East-West Line disruption resolved', 'Service resumed at 6:45 PM.', 'infrastructure', 'low', 'West', 'manual', 'resolved', '2026-06-04T18:45:00+08:00');

INSERT INTO dashboard.data_snapshots (source_id, crisis_type, snapshot_key, captured_at, payload)
SELECT
  id,
  'general',
  'dashboard-ui-seed-2026-06-07',
  '2026-06-07T20:45:00+08:00',
  '{
    "activeCrises": 4,
    "publicStats": {
      "covidCasesToday": 378,
      "airQualityPsi": 156,
      "essentialSupplyLevel": 94,
      "overallSituation": "Elevated"
    },
    "nearbyResources": [
      {"name": "Singapore General Hospital", "type": "Hospital", "distance": "1.2 km", "status": "Available"},
      {"name": "Tanjong Pagar CC", "type": "Shelter", "distance": "800 m", "status": "Available"},
      {"name": "Outram Park Clinic", "type": "Clinic", "distance": "1.5 km", "status": "Available"}
    ]
  }'::jsonb
FROM dashboard.data_sources
WHERE code = 'signal_ui_seed'
ON CONFLICT (source_id, snapshot_key, captured_at) DO NOTHING;
