# codexp-signal


## Hackathon mission: Quick Aid

SiGnal is a Singapore-focused fast response web application for disaster and health emergency coordination. It is designed to gather information from multiple sources - including outbreak signals, hospital capacity, weather and flood risks, medicine supply constraints, citizen reports, and volunteer readiness - so leaders, responders, and communities can make quicker, clearer decisions during crises.

Core product goals:

- Provide a government command centre for real-time situational awareness, alerts, heatmaps, projections, and broadcast coordination.
- Provide a public portal for verified advisories, nearby resources, incident reporting, tickets, volunteer sign-ups, and community updates.
- Keep a demo-ready fallback dataset available so the frontend can run even when the local backend is offline.

SiGnal has two main local apps:

- `app/` - frontend Vite/React app
- `backend/` - backend API server and local PostgreSQL setup

## Run the website only

Docker is not required for the normal website/demo mode. The frontend uses
committed fallback data when the local backend is not running.

```bash
cd app
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Run the full system

Use this if you want the backend API and PostgreSQL database too.

1. Install dependencies in both folders:

```bash
cd backend
npm install

cd ../app
npm install
```

2. Create the backend `.env` file if it does not exist:

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell, use this instead:

```powershell
cd backend
Copy-Item .env.example .env
```

3. Choose a database mode.

Neon remote database, no Docker:

```bash
cd backend
npm run db:init:remote
```

Local Docker database:

```bash
cd backend
npm run db:init
```

## Daily local run

Use two terminals.

Terminal 1, backend with Neon:

```bash
cd backend
npm run dev
```

Terminal 1, backend with local Docker Postgres:

```bash
cd backend
npm run db:up
npm run dev
```

Backend URL:

```text
http://localhost:4000
```

Terminal 2, frontend:

```bash
cd app
npm run dev
```

If the backend shows a database error, check that `backend/.env` has a valid `DATABASE_URL`. If you use local Docker Postgres, also make sure Docker Desktop is running.

## Backend database commands(internal)

Run these from `backend/`.

Start PostgreSQL:

```bash
npm run db:up
```

Stop PostgreSQL:

```bash
npm run db:down
```

Wait until PostgreSQL is ready:

```bash
npm run db:wait
```

Apply schema files:

```bash
npm run db:schema
```

Apply schema files through Node using `DATABASE_URL` instead of Docker:

```bash
npm run db:schema:node
```

Load dashboard data from committed backend JSON files:

```bash
npm run db:seed:json
```

Create a demo government admin user:

```bash
$env:DEMO_ADMIN_EMAIL="admin@signal.local"
$env:DEMO_ADMIN_PASSWORD="replace-with-temp-admin-password"
npm run db:seed:auth
```

Create the demo government profile users:

```bash
npm run db:seed:profiles
```

This creates `MOH`, `PUB`, `LTA`, `SCDF`, `SPF`, `NEA`, `Enterprise SG`, `Form Handler`, and `Admin`. For demo use, each username has the same password as the username.

Create the demo citizen user:

```bash
npm run db:seed:citizen
```

This creates `user` / `user` for the public portal.

Reset citizen/form-handling tickets to the committed demo set:

```bash
npm run db:seed:tickets
```

This clears `citizen.reports` and reloads `backend/data/ticket-seed.json`.

Apply old SQL seed files:

```bash
npm run db:seed
```

Start database, apply schemas, and seed from JSON:

```bash
npm run db:init
```

Apply schemas and seed JSON into a remote Postgres database such as Neon:

```bash
npm run db:init:remote
```

Fully wipe and rebuild the local database:

```bash
npm run db:reset
```

Use `db:reset` when `db:init` fails because schemas/types already exist and you want a clean database.

## Neon database setup

Neon does not need Docker Desktop. Create a Neon project, then copy the Postgres connection string from Neon's **Connect** modal.

Use the pooled connection string if this backend is deployed as serverless functions. It usually has `-pooler` in the hostname.

Put the connection string in `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

Then initialize Neon from `backend/`:

```bash
npm run db:init:remote
npm run dev
```

You do not need to share a Neon API token for normal app setup. The app only needs `DATABASE_URL`.

## Data refresh

The external dashboard snapshot is stored in:

```text
backend/data/dashboard-data.json
```

Refresh it from external APIs:

```bash
cd app
npm run refresh:data
```

Then reload the refreshed JSON into PostgreSQL:

```bash
cd ../backend
npm run db:seed:json
```

## Build checks

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd app
npm run build
```
