# Hazmat Response Support — Backend Server

Hono REST API + the static UI, backed by SQLite. This is the whole app — there's no
separate frontend dev server anymore.

## Quick start

```bash
cd server
npm install
npm run db:init-sqlite   # creates ./local.db with all tables
npm run db:seed          # loads bundled data into SQLite
npm run dev              # starts everything at http://localhost:3000
```

Verify:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/manifest
curl http://localhost:3000/api/chemicals?q=ammonia
```

Or just open `http://localhost:3000/` in a browser — that's the UI.

## Architecture

```text
Browser ──> Hono (Node 20) ──┬──> serves server/public/ (static UI) at "/"
                              └──> serves /api/* from SQLite (local.db)
```

- **Hono** — tiny HTTP framework. Routes in `src/app.ts`.
- **Drizzle ORM** — type-safe queries. Schema in `src/schema.ts`.
- **better-sqlite3** — synchronous SQLite driver for Node. Fast, zero-config.
- **SQLite** — single-file database at `./local.db`. Back up by copying the file.
- **`src/app.ts`** also serves `./public` as static files via `@hono/node-server`'s
  `serveStatic` — that's `server/public/index.html` + `script.js` + `styles.css`.

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
| POST | `/api/plume/run` | Runs the real Gaussian plume/puff model, returns isopleths |
| GET | `/api/facilities?q=` | Tier II facilities |
| GET | `/api/facilities/:id` | Single facility with chemicals |
| GET | `/api/sync/:clientId` | Full delta sync (all tables) |
| GET | `/api/wildfire/firms?west=&south=&east=&north=&hours=` | NASA FIRMS NOAA-20/21 detections in map bounds |
| GET | `/api/wildfire/perimeters?west=&south=&east=&north=` | NIFC / WFIGS fire perimeters in map bounds |
| GET | `/api/wildfire/smoke?west=&south=&east=&north=` | NOAA HMS smoke polygons in map bounds |
| GET | `/api/wildfire/status?west=&south=&east=&north=` | Current status and counts for all wildfire feeds |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server with hot reload (tsx watch) |
| `npm run start` | Start server in production mode |
| `npm run db:init-sqlite` | Create SQLite tables |
| `npm run db:seed` | Load bundled data into SQLite (idempotent, safe to re-run) |
| `npm run db:generate` | Generate a Drizzle migration from a schema.ts change |
| `npm run db:migrate` | Apply Drizzle migrations (not yet exercised — schema changes today go through `db:init-sqlite`'s `CREATE TABLE IF NOT EXISTS`, which won't alter existing tables; use this once an existing deployed DB needs a real schema change) |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm test` | Run tests |
| `npm run typecheck` | TypeScript check |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SQLITE_PATH` | `./local.db` | SQLite database file path |
| `NASA_FIRMS_MAP_KEY` | empty | Server-only NASA FIRMS key; empty means active fire detections report `NOT CONFIGURED` |

### External feed provenance

- NASA FIRMS is used for NOAA-20/NOAA-21 VIIRS thermal active-fire detections. Its web-service metadata is retained with the response, including an approximately 15-minute refresh cadence; FIRMS detections are not fire perimeter polygons.
- NIFC / WFIGS is used for current interagency fire perimeter polygons through the WFIGS Current Perimeters feature service. It remains a separate layer and status from NASA FIRMS detections.
- NCES EDGE school locations are geocoded points used in HazScope's own point-in-polygon threat-zone analysis; the resulting matches require operational verification.
- EPA Tier II documentation defines the reporting framework. E-Plan/Tier II facilities in this app are authorized imported facility data, not a live EPA facility feed.

## Docker

```bash
docker compose up --build   # from the repo root
```

`server/docker-entrypoint.sh` seeds the database on first boot if `$SQLITE_PATH` doesn't
exist yet, then starts the server. See the root `Dockerfile`/`docker-compose.yml`.

## Backup

```bash
cp server/local.db server/local.db.backup
```

That's it. The entire database is one file. (In Docker, back up the named volume instead.)
