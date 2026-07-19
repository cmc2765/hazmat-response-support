// Server entrypoint — starts the Hono API on the configured port.
// Default: http://localhost:3000

import { serve } from "@hono/node-server";
import app from "./app.js";
import { getDb } from "./db.js";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

// Warm the DB connection so errors surface at startup.
getDb();

serve({ fetch: app.fetch, hostname, port }, (info) => {
  console.log(
    `[server] Hono API listening on http://localhost:${info.port} (bound to ${hostname})`,
  );
  console.log(`[server] Try: http://localhost:${port}/api/manifest`);
});
