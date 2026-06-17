FROM golang:1.26-bookworm AS go-build
WORKDIR /src
COPY risk-engine/ ./risk-engine/
COPY watchdog/ ./watchdog/
RUN cd risk-engine && CGO_ENABLED=0 go build -o /out/risk-engine . \
 && cd ../watchdog && CGO_ENABLED=0 go build -o /out/watchdog .

FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm i -g @trustwallet/cli && npm cache clean --force
COPY src/ ./src/
COPY config.json ./
COPY deploy/config.docker.json ./config.docker.json
COPY --from=go-build /out/risk-engine /out/watchdog /usr/local/bin/
EXPOSE 8080 8081
CMD ["node", "src/index.ts"]
