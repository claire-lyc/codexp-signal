# SiGnal Backend

This folder is reserved for backend, database, API, and server-side integration work.

The frontend remains in `app/`.

## Proposed stack

- Runtime: Node.js
- Language: TypeScript
- API style: REST first
- Database: PostgreSQL
- File handling: multipart upload for citizen report images
- Future options: WebSocket/SSE for live dashboard updates

## Folder layout

- `src/` - TypeScript backend API server
- `data/` - committed JSON dashboard snapshots used for local seeding
- `database/` - PostgreSQL schema and setup files
- `api/` - local backend endpoint documentation
- `docs/` - endpoint contracts and backend notes

## Local run

Install dependencies:

```bash
npm install
```

Start PostgreSQL:

```bash
npm run db:up
```

Apply schemas and seed from committed backend JSON:

```bash
npm run db:init
```

Reseed dashboard data after editing `backend/data/*.json`:

```bash
npm run db:seed:json
```

Start API server:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:4000/health
```
