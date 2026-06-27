# Hazmat Response Support — Backend Server

SQLite + Hono REST API. Serves chemical, NIOSH, ERG, threshold, and facility
data to the PWA.

## Quick start

```bash
cd server
npm install
npm run db:init-sqlite   # creates ./local.db with all tables
npm run db:seed          # loads bundled data into SQLite
npm run dev              # starts API at http://localhost:3000
```

Verify:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/manifest
curl http://localhost:3000/api/chemicals?q=ammonia
```

## Architecture

```
PWA (browser) ──> Vite proxy /api ──> Hono API (Node 20) ──> SQLite (local.db)
```

- **Hono** — tiny HTTP framework. Routes in `src/app.ts`.
- **Drizzle ORM** — type-safe queries. Schema in `src/schema.ts`.
- **better-sqlite3** — synchronous SQLite driver for Node. Fast, zero-config.
- **SQLite** — single-file database at `./local.db`. Back up by copying the file.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/manifest` | Data version + source metadata |
| GET | `/api/chemicals?q=&class=` | List/search chemicals |
| GET | `/api/chemicals/:id` | Single chemical |
| GET | `/api/npg` | NIOSH Pocket Guide records |
| GET | `/api/npg/:id` | Single NPG record |
| GET | `/api/erg` | ERG Table 1 entries |
| GET | `/api/erg/:un` | ERG entry by UN number |
| GET | `/api/thresholds?chemicalId=` | AEGL/ERPG/TEEL thresholds |
| GET | `/api/facilities?q=` | Tier II facilities |
| GET | `/api/facilities/:id` | Single facility with chemicals |
| GET | `/api/sync/:clientId` | Full delta sync (all tables) |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API with hot reload (tsx watch) |
| `npm run start` | Start API in production mode |
| `npm run db:init-sqlite` | Create SQLite tables |
| `npm run db:seed` | Load bundled data into SQLite |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run scrape:tier2` | Run Tier II scraper (scaffold) |
| `npm test` | Run tests |
| `npm run typecheck` | TypeScript check |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API port |
| `SQLITE_PATH` | `./local.db` | SQLite database file path |

## Backup

```bash
cp server/local.db server/local.db.backup
```

That's it. The entire database is one file.