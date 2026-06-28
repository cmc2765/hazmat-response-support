# Working guide — who edits what

This repo has two parts that can be worked on independently, and they live on two branches:

| Branch | Who | Folder | What's there |
|--------|-----|--------|--------------|
| `frontend` | your coworker | `server/public/` | The UI — plain HTML/CSS/JS, no build step. `index.html`, `script.js`, `styles.css`, `assets/` |
| `backend` | you | `server/src/`, `src/data/`, `src/lib/`, `scripts/` | The API, the database, the chemical/plume data |

`main` is the shared, working version of the app. Both branches merge into `main` through a Pull Request (see workflow below).

## Frontend (UI) — your coworker

Everything lives in `server/public/`:

| File | What's there |
|------|-------------|
| `index.html` | All the views/screens (home, lookup, plume, facilities, etc.) |
| `script.js` | All the behavior — view switching, calling the API, rendering data |
| `styles.css` | All the styling |
| `assets/` | Images (department logo, etc.) |

The UI is served directly by the backend — there's no separate frontend dev server anymore. To see your changes:

```bash
cd server
npm install      # first time only
npm run dev
```

Then open `http://localhost:3000/` (in Codespaces, it'll prompt "Open in Browser" when the server starts — click that).

**Don't touch:** anything outside `server/public/`. If the UI needs data the API doesn't provide yet, don't add it yourself — tell the backend person what you need (see API contract below) and they'll add it.

## Backend — you

| Directory | What's there |
|-----------|-------------|
| `server/src/app.ts` | All API routes |
| `server/src/schema.ts` | Database table definitions (Drizzle) |
| `server/src/seed.ts` | Loads data into the database |
| `src/data/` | Chemical, NPG, ERG, threshold, facility data |
| `src/lib/model/` | The plume dispersion math |
| `src/lib/schema/` | Zod type definitions (the shared contract) |
| `scripts/` | Data pipelines (ERG, CAMEO, NIOSH, Tier II) |

### Running it

```bash
cd server
npm install                 # first time only
npm run db:init-sqlite      # first time only: creates the database
npm run db:seed             # first time only: loads data into it
npm run dev                 # starts everything (UI + API) at http://localhost:3000
```

### The API contract

The frontend talks to the backend through these endpoints (defined in `server/src/app.ts`):

```
GET  /api/manifest          → data version + source metadata
GET  /api/chemicals?q=      → search chemicals
GET  /api/chemicals/:id     → single chemical
GET  /api/npg               → NIOSH records
GET  /api/npg/:id           → single NIOSH record
GET  /api/erg/:un           → ERG distances by UN number
GET  /api/thresholds        → AEGL/ERPG/TEEL values (optional ?chemicalId=)
POST /api/plume/run         → runs the real plume model, returns isopleths/distances
GET  /api/facilities?q=     → Tier II facilities
GET  /api/facilities/:id    → single facility with its chemical inventory
GET  /api/sync/:clientId    → full data sync
```

If you change what an endpoint returns or add a new one, tell your coworker so they can update the UI to match.

## Day-to-day workflow (using the Codespaces UI — no terminal commands needed)

Both of you follow the same steps every time — just swap `frontend` for `backend` depending on which one is yours.

### 1. Starting work for the day

1. Open your Codespace.
2. Bottom-left corner of the window shows the current branch name. Click it.
3. Pick your branch (`frontend` or `backend`) from the list.
4. Click the **sync icon** (circular arrows) next to the branch name in the bottom-left — this pulls down anything that was merged into `main` since you last worked, so you're starting from the latest version.

### 2. While you work

Just edit files normally. Nothing to commit yet — that happens when you're ready to save a checkpoint.

### 3. Saving your work (commit)

1. Click the **Source Control icon** in the left sidebar (it shows a number badge for how many files changed).
2. You'll see a list of changed files. Type a short message describing what you changed in the box at the top (e.g. "Fixed plume distance display").
3. Click the **checkmark (✓ Commit)** button above the message box.

### 4. Sharing your work (push)

1. Right after committing, the bottom-left sync icon will show you're "ahead" of the remote.
2. Click that sync icon again — this pushes your commit up to GitHub.

### 5. Getting your work into `main`

1. Go to the repo on **github.com** in a browser tab.
2. GitHub usually shows a yellow banner: "`frontend` had recent pushes — Compare & pull request." Click it. (If you don't see it, go to the **Pull requests** tab → **New pull request** → set base: `main`, compare: `frontend` or `backend`.)
3. Click **Create pull request**.
4. The other person takes a quick look, then clicks the green **Merge pull request** button → **Confirm merge**.

That's it — no merge commands, no conflict resolution tools needed for the normal case, since you're working in separate folders.

### If GitHub says there's a merge conflict

This only happens if you both changed the same file. Since you're working in separate folders (`server/public/` vs. everything else), this should be rare. If it happens, stop and message each other — don't guess which version to keep.

**Rule of thumb:** stay in your own folder (frontend = `server/public/` only, backend = everything else) and you'll almost never see a conflict.
