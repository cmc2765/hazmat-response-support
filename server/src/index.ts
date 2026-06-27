// Server entrypoint — starts the Hono API on the configured port.
// Default: http://localhost:3000

import { serve } from "@hono/node-server";
import app from "./app.js";
import { getDb } from "./db.js";

const port = Number(process.env.PORT ?? 3000);

// Warm the DB connection so errors surface at startup.
getDb();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] Hono API listening on http://localhost:${info.port}`);
  console.log(`[server] Try: http://localhost:${port}/api/manifest`);
});