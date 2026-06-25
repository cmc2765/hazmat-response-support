# Hazmat Response Support

A single-user, offline-first Progressive Web App for fire-department hazardous materials response.
Replaces CAMEO Chemicals + ERG with fast chemical lookup, on-scene plume modeling,
NIOSH Pocket Guide data, Tier II facility awareness, incident logging, and live integrations
for Honeywell RAE monitors (Safety Suite local), online weather (NWS / Open-Meteo),
and Columbia Weather Systems microServer.

See [PLAN.md](./PLAN.md) for the full v1 design, scope, phasing, and risks.

## Status

**M0 — Skeleton.** Vite + React + TypeScript + Tailwind + shadcn/ui + PWA + Workbox + Dexie.
No application logic yet. Subsequent milestones:

- **M1** Chemical core (ERG + CAMEO)
- **M2a** Threat-zone distances (ERG Table 1/3)
- **M2b** NIOSH Pocket Guide
- **M3** Gaussian plume model + MapLibre isopleth overlay
- **M4** Tier II facility scrapers (EPA / state / erplan.net)
- **M5** Incident log + PDF/JSON export
- **M6** Polish (a11y, perf, install prompt, offline UX)
- **M7** Live integrations (Safety Suite local, weather, CWS microServer)

## Development

```bash
npm install
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest
npm run test:e2e     # Playwright
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
Data sources (ERG, CAMEO, NIOSH NPG, AEGL, ERPG, TEEL) are public domain and credited
in-app on the Sources page.
