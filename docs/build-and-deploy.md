# Build & deploy

The app ships as a single Docker container — one Hono server serves both the static UI
(`server/public/`) and the API, backed by SQLite. There's no separate static-host build
step anymore (no `dist/`, no Vite, no service worker).

```bash
docker compose up --build
```

This builds the image from the root `Dockerfile`, starts the container, and serves the
app at `http://localhost:3000`. On first boot, `server/docker-entrypoint.sh` creates and
seeds the SQLite database if one doesn't already exist at `$SQLITE_PATH`; subsequent
restarts reuse it via the `hazmat-data` named volume.

Verified to work with **no internet access at runtime** (`docker run --network none`) —
all dependencies, including `tsx`, are bundled into the image rather than fetched on
first run.

## CI checks

Before merging, run the same checks CI would:

```bash
npm ci && npm run typecheck && npm run lint && npm test       # root: shared data/model/lib
cd server && npm ci && npm run typecheck && npm run lint && npm test   # server + API
```

## Data

`src/data/*.ts` is hand-curated today (chemicals, NPG, ERG, thresholds, facilities) — there
is no automated ingestion pipeline yet. Pulling from external government/private APIs is a
planned future phase (see project notes) and would likely live as a new `scripts/` pipeline
writing into `src/data/` once built.

## Secrets

Integration secrets (Safety Suite auth, weather API keys) are currently held in memory on
the server process (`src/integrations/security.ts`) — these integrations aren't wired
into a live caller yet. Once they are, secrets should move to a real persistent store
(e.g. a SQLite table) rather than being lost on restart.
