# AGENTS.md

This repository is the Hazmat Response Support app: the UI is served from `server/public/`, the API and database live under `server/src/`, and shared data/model logic lives under `src/`.

## Start here

- Project overview: [README.md](README.md)
- Contribution workflow: [CONTRIBUTING.md](CONTRIBUTING.md)
- Server and API details: [server/README.md](server/README.md)

## Working rules

- Keep changes scoped to the right layer. UI work belongs in `server/public/`; backend/data work belongs in `server/src/` and `src/`.
- Do not introduce a framework, build step, or package-heavy frontend stack unless the repo already establishes it. This app intentionally uses plain HTML, CSS, and JavaScript served directly by the backend.
- Prefer small, readable edits over broad refactors. Reuse existing patterns before inventing new structure.
- Preserve offline-first behavior and field usability: minimize dependencies, keep assets local, and avoid hidden runtime requirements.
- If the UI needs API data that does not exist yet, describe the contract change rather than silently adding ad hoc client-side logic.

## Build and validation

Run the smallest relevant command:

```bash
npm run typecheck
npm run lint
npm run test
```

For server/UI work, use the app from the server flow:

```bash
cd server
npm install
npm run db:init-sqlite
npm run db:seed
npm run dev
```

## UI design guidance

When working on website or software interfaces, prefer polished, high-end visual quality using efficient, low-overhead patterns:

- Favor readable typography, strong contrast, clear hierarchy, and large tap targets.
- Use handcrafted CSS and restrained motion instead of heavy animation libraries or large asset payloads.
- Keep interactions fast and predictable; optimize for field conditions, not just desktop aesthetics.
- Prefer compact, reusable styling patterns and native browser capabilities over over-engineered component systems.
- Treat graphics as supporting the information, not dominating it. High-end polish should come from layout, spacing, contrast, and detail — not from expensive visual tricks or large media files.
- Keep the interface easy to scan under stress: emergency workflows, minimal visual clutter, and strong status cues.
- Prefer lower credit / lower compute usage design choices: simple gradients, layered shapes, crisp typography, and efficient DOM patterns over resource-heavy visual effects.

## Key directories

- `server/public/`: static UI (`index.html`, `script.js`, `styles.css`, `assets/`)
- `server/src/`: Hono routes, Drizzle schema, app logic
- `src/data/`: curated chemical, ERG, NIOSH, and facility datasets
- `src/lib/`: plume and shared model logic

## Special notes

- The backend serves the UI directly; there is no separate frontend server.
- The app is designed for offline use in emergency response contexts.
- Keep the product grounded in fast operational decision support, not decorative complexity.
