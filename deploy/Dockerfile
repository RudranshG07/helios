# 1. Go risk engine + watchdog
FROM golang:1.26-bookworm AS go-build
WORKDIR /src
COPY risk-engine/ ./risk-engine/
COPY watchdog/ ./watchdog/
RUN cd risk-engine && CGO_ENABLED=0 go build -o /out/risk-engine . \
 && cd ../watchdog && CGO_ENABLED=0 go build -o /out/watchdog .

# 2. Web app (frontend)
FROM node:24-bookworm-slim AS web-build
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 3. Runtime: control plane serves the web app + API and spawns the agents
FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm i -g @trustwallet/cli && npm cache clean --force
COPY src/ ./src/
COPY control-plane/ ./control-plane/
COPY config.json ./
COPY --from=web-build /web/dist ./web/dist
COPY --from=go-build /out/risk-engine ./risk-engine/bin/risk-engine
COPY --from=go-build /out/watchdog ./watchdog/bin/watchdog
ENV PORT=8090
EXPOSE 8090
CMD ["node", "--disable-warning=ExperimentalWarning", "control-plane/server.ts"]
