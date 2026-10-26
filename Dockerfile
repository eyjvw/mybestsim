# Two images from one Dockerfile:
#   --target ingest  Bun service that validates and publishes supplier CSVs into /data
#   --target web     Caddy serving the built site, /data (read-only) and /api -> ingest
# `web` is last, so a plain `docker build .` still produces the site image.
FROM oven/bun:1.4.4 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
RUN bun run validate && bun run build

FROM oven/bun:1.4.4 AS ingest
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production
COPY src/lib ./src/lib
COPY server ./server
# Reference data, published as the first release when the volume is empty.
COPY data ./seed
ENV DATA_DIR=/data SEED_DIR=/app/seed PORT=3000 NODE_ENV=production
# A named volume copies this directory's ownership on first use: the service can write.
RUN mkdir -p /data && chown bun:bun /data
VOLUME /data
EXPOSE 3000
USER bun
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["bun", "server/main.ts"]

FROM caddy:2.11-alpine AS web
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/version.json || exit 1
