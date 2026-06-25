# Build & deploy

GitHub Actions (or any static host pipeline) builds the PWA and deploys:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
```

`vite build` emits a static site to `dist/` plus a Workbox-generated service worker.
Deploy `dist/` to any static host (Cloudflare Pages, GitHub Pages, Netlify).

## Required environment for data pipelines

The data scripts in `scripts/` require Node ≥ 20 and (later milestones) write access
to `public/data/`. CI should run `npm run data:all` after a successful build and
commit any new bundles.

## Secrets

Integration secrets (ProRAE Cloud, Safety Suite auth, weather API keys) live in the
client's IndexedDB and never appear in the build output or in exports.
