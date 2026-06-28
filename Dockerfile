# Single-container build: Hono API + static HazMatIQ UI + SQLite, no internet
# required at runtime. Build context is the repo root (the server imports the
# shared data/model/schema code from /src via relative paths).

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY src ./src
COPY server ./server

ENV SQLITE_PATH=/data/local.db
ENV PORT=3000

EXPOSE 3000
VOLUME ["/data"]

WORKDIR /app/server
ENTRYPOINT ["./docker-entrypoint.sh"]
