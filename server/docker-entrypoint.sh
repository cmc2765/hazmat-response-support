#!/bin/sh
set -e

if [ ! -f "$SQLITE_PATH" ]; then
  echo "[entrypoint] no database found at $SQLITE_PATH, creating and seeding it..."
  npx tsx src/init-sqlite.ts
  npx tsx src/seed.ts
fi

exec npx tsx src/index.ts
