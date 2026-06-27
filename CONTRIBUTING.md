# Working guide — who edits what

This repo has two parts that can be worked on independently.

## Frontend (UI) — your coworker

All files under `src/` except `src/data/` and `src/lib/schema/` and `src/lib/sync.ts`.

| Directory | What's there | What to do |
|-----------|-------------|------------|
| `src/features/` | Page components (search, plume map, chemical detail, facilities, incidents, sensors, settings) | Add pages, improve layouts, change how things look |
| `src/components/` | Shared UI components (buttons, cards, badges) | Add reusable components here |
| `src/app/` | Routing, navigation bar, layout shell, Bootstrap | Change navigation, add routes, adjust layout |
| `src/app/index.css` | Tailwind classes and custom styles | Change colors, spacing, fonts |
| `tailwind.config.js` | Theme (colors, sizes, dark mode) | Adjust the visual theme |
| `index.html` | HTML shell, PWA manifest link | Change page title, meta tags |

### Running the frontend

```bash
npm install
npm run dev          # starts at http://localhost:5173
```

The frontend works standalone — it has bundled data and doesn't need the backend running.

### What NOT to touch

- `server/` — that's the backend
- `src/data/` — that's the chemical data (managed by backend person)
- `src/lib/schema/` — that's the type definitions (shared contract, managed by backend person)
- `src/lib/sync.ts` — that's the server connection (managed by backend person)

## Backend — you

All files under `server/` plus `src/data/`, `src/lib/schema/`, and `src/lib/sync.ts`.

| Directory | What's there | What to do |
|-----------|-------------|------------|
| `server/src/` | Hono API, Drizzle schema, database connection, seed script | Add API endpoints, change database schema |
| `server/src/schema.ts` | Database table definitions | Add tables, change columns |
| `server/src/seed.ts` | Loads data into the database | Update when data files change |
| `server/scripts/` | Scrapers (Tier II, etc.) | Add data pipelines |
| `src/data/` | Chemical, NPG, ERG, threshold, facility data | Add chemicals, update values |
| `src/lib/schema/` | Zod type definitions (the shared contract) | Add fields, change types |
| `src/lib/sync.ts` | PWA ↔ server sync client | Change how data syncs |

### Running the backend

```bash
cd server
npm install
npm run db:init-sqlite   # one-time: creates the database
npm run db:seed          # loads data into the database
npm run dev              # starts API at http://localhost:3000
```

### The API contract

The frontend talks to the backend through these endpoints (defined in `server/src/app.ts`):

```
GET /api/manifest          → data version + source metadata
GET /api/chemicals?q=      → search chemicals
GET /api/chemicals/:id     → single chemical
GET /api/npg               → NIOSH records
GET /api/erg/:un           → ERG distances by UN number
GET /api/thresholds        → AEGL/ERPG/TEEL values
GET /api/facilities?q=     → Tier II facilities
GET /api/facilities/:id    → single facility with chemicals
GET /api/sync/:clientId    → full data sync
```

If you change what an endpoint returns, tell your coworker so they can update the UI.

## Git workflow for two people

```bash
# Before starting work:
git pull origin main

# Create a branch for your changes:
git checkout -b ui-improve-plume-page    # coworker
git checkout -b backend-add-chemicals    # you

# Make your changes, then:
git add .
git commit -m "describe what you changed"
git push origin ui-improve-plume-page

# When ready to merge into main:
git checkout main
git pull origin main
git merge ui-improve-plume-page
git push origin main
```

If git says "merge conflict" — that means you both changed the same line in the same file. Ask each other which version to keep, then commit again.

**Rule of thumb:** if you stay in your own directories (frontend vs backend), you will almost never have conflicts.