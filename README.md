# codexp-signal

SiGnal has two main local apps:

- `app/` - frontend Vite/React app
- `backend/` - backend API server and local PostgreSQL setup

## First-time setup
1. Install dependencies in both folders:
```bash
cd backend
npm install

cd ../app
npm install
```

2. Make sure Docker Desktop is running before starting the database.

3. Create the backend `.env` file if it does not exist:

```bash
cd backend
cp .env.example .env
```

On Windows PowerShell, use this instead:

```powershell
cd backend
Copy-Item .env.example .env
```

4. Initialize the local database:

```bash
npm run db:init
```

## Daily local run

Use two terminals.

Terminal 1, backend:

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

If 500 Error, remember to load up your docker Desktop

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

Load dashboard data from committed backend JSON files:

```bash
npm run db:seed:json
```

Apply old SQL seed files:

```bash
npm run db:seed
```

Start database, apply schemas, and seed from JSON:

```bash
npm run db:init
```

Fully wipe and rebuild the local database:

```bash
npm run db:reset
```

Use `db:reset` when `db:init` fails because schemas/types already exist and you want a clean database.

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
