# Database Setup

## Local Docker

From `backend/`:

```bash
cp .env.example .env
npm run db:init
```

Default connection:

```text
postgres://signal_app:signal_dev_password@localhost:5432/signal
```

Start database only:

```bash
npm run db:up
```

Apply schema files only:

```bash
npm run db:schema
```

Apply seed data only:

```bash
npm run db:seed:json
```

`db:seed:json` reads committed JSON snapshots from `backend/data/` and writes them into PostgreSQL.

Legacy SQL seed files can still be applied with:

```bash
npm run db:seed
```

Reset local database and reload schema/seed:

```bash
npm run db:reset
```

Stop database:

```bash
npm run db:down
```

Delete local database volume:

```bash
docker compose down -v
```
