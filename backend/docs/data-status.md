# Data Status

This document tracks which parts of the app are dynamic, fake, cached, or live.

## Current data flow

Dashboard data now follows this local development flow:

1. JSON snapshots live in `backend/data/`.
2. `npm run db:seed:json` reads those JSON files and inserts rows into PostgreSQL.
3. `backend/src/server.ts` exposes REST endpoints from PostgreSQL.
4. Frontend dashboard pages call those backend endpoints through `app/src/app/lib/api.ts`.

The old dashboard JSON copies under `app/src/data/` were removed. The frontend still keeps `app/src/data/singapore-planning-areas.json` because that is map geometry used by `SingaporeRegionMap`, not dashboard records.

## Backend source files

- `backend/data/dashboard-data.json` - cached external dashboard snapshot
- `backend/data/dashboard-ui-data.json` - demo dashboard UI payloads
- `backend/src/seedDashboardFromJson.ts` - JSON-to-PostgreSQL seeder
- `backend/src/server.ts` - REST API
- `backend/src/dashboardRepository.ts` - PostgreSQL reads
- `backend/src/db.ts` - database connection

Preferred local seed command from `backend/`:

```bash
npm run db:init
```

To reseed from the backend JSON files after editing them:

```bash
npm run db:seed:json
```

## Dynamic/generated elements

- Government overview, alerts, crisis cards, trends, and risk summary now render from backend API data.
- Citizen home stats, active alerts, resources, and updates now render from backend API data.
- Citizen incidents now render from backend API data.
- Cybersecurity metrics/threats now render from backend API data.
- Recommendations, sentiment, and historical analysis now render from backend API data.
- Weather, health/dengue, supply chain, and infrastructure dashboards now call the backend cached-external endpoint.
- `SingaporeRegionMap` dynamically renders SVG paths, labels, markers, zoom, and hover state from map geometry and marker props.
- Government overview filters, public alert accordion expansion, and other UI controls remain dynamic frontend state.

## Fake/demo data

These are still fake or manually seeded demo data, even though they are now served through PostgreSQL:

- `backend/data/dashboard-ui-data.json`
- `dashboard_overview`
- `dashboard_public_home`
- `dashboard_public_incidents`
- `dashboard_cybersecurity`
- `dashboard_recommendations`
- `dashboard_sentiment`
- `dashboard_historical`
- Form Handling ticket list
- Broadcast Centre list and compose result
- Volunteer pages
- Public forum posts
- Most public alert wording and historical summaries

## Cached external data

`backend/data/dashboard-data.json` is not fake, but it is not live at render time.

It was produced by `app/scripts/refresh-dashboard-data.mjs`, which fetches external sources and now writes the snapshot into `backend/data/dashboard-data.json`.

Cached external data currently includes:

- NEA/data.gov.sg weather readings
- NEA dengue cluster GeoJSON
- MOH infectious disease historical records
- LTA traffic camera metadata and image URLs
- SingStat import price and retail sales indicators

## Camera feed status

The camera feed is not fake, but it is also not a live video stream.

The app displays LTA traffic camera image URLs stored in `backend/data/dashboard-data.json` and served from PostgreSQL through the backend API. Those URLs came from a previous refresh of the data.gov.sg traffic-images API, so they are real external camera snapshot URLs from the cached refresh time.

Future intended flow:

1. Backend refresh job calls data.gov.sg traffic-images API.
2. Backend stores camera metadata/image URLs in PostgreSQL.
3. Frontend calls backend endpoint.
4. Frontend displays latest stored snapshot.
