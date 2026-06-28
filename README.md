# Hazmat Response Support

An offline-capable hazmat response tool for fire departments: fast chemical lookup (ERG +
CAMEO + NIOSH Pocket Guide), on-scene plume modeling, Tier II facility awareness, and a
tap-driven UI built for use on scene under pressure.

Ships as a single Docker container — one Hono server serves both the UI and the API,
backed by a local SQLite database. No internet connection required at runtime.

See [PLAN.md](./PLAN.md) for the original v1 design (now partly superseded — see below),
[CONTRIBUTING.md](./CONTRIBUTING.md) for who works on what and the day-to-day git workflow,
and [NOTES.md](./NOTES.md) for the shared scratchpad.

## Architecture

```text
Browser ──> Hono server (server/src/app.ts) ──┬──> server/public/ (static UI)
                                                └──> SQLite (server/local.db)
```

- **UI** — `server/public/`: plain HTML/CSS/JS, no build step.
- **API + data** — `server/src/`: Hono routes, Drizzle ORM, SQLite. Seeded from the
  hand-curated chemical/NIOSH/ERG/threshold/facility data in `src/data/`.
- **Plume model** — `src/lib/model/`: in-house Gaussian puff/plume math, called by the
  API's `POST /api/plume/run`.

## Status

The original plan (PWA + React + IndexedDB caching, see PLAN.md §4) was replaced with a
simpler single-container architecture: one Node/Hono server serves a plain HTML/CSS/JS UI
and a SQLite-backed API. Current state:

- Chemical lookup (207 chemicals), NIOSH Pocket Guide data, ERG distances, AEGL/ERPG/TEEL
  thresholds, Tier II facilities, and the real Gaussian plume model are all wired up and
  serving live data.
- Map view, live weather/RAE sensor integration, and broader external data ingestion are
  not built yet — see "Future phases" in `CONTRIBUTING.md`/recent project notes.

## Development

Two independent pieces — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide:

```bash
# Backend + UI (the actual app — UI is served by the backend)
cd server
npm install
npm run db:init-sqlite   # first time only
npm run db:seed          # first time only
npm run dev              # http://localhost:3000

# Shared data/model/schema library (root) — typecheck, lint, test
npm install
npm run typecheck
npm run lint
npm run test
```

## Running in Docker

```bash
docker compose up --build
```

Serves the app at `http://localhost:3000`. The SQLite database lives in a named Docker
volume (`hazmat-data`), so it survives container restarts/rebuilds. No internet access is
required at runtime — verified with `docker run --network none`.

## License

Apache-2.0. See [LICENSE](./LICENSE).
Data sources (ERG, CAMEO, NIOSH NPG, AEGL, ERPG, TEEL) are public domain — see
[docs/sources.md](./docs/sources.md) for full attribution.
