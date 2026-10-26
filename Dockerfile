# Build the static site with Bun, then serve dist/ with Caddy.
FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA
RUN bun run validate && bun run build

FROM caddy:2.11-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
