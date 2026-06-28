#!/bin/sh
set -e

if [ ! -f "$SQLITE_PATH" ]; then
  echo "[entrypoint] no database found at $SQLITE_PATH, creating and seeding it..."
  ./node_modules/.bin/tsx src/init-sqlite.ts
  ./node_modules/.bin/tsx src/seed.ts
fi

exec ./node_modules/.bin/tsx src/index.ts
