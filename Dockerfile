FROM node:24-bookworm-slim AS client
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY server/assets ./assets
COPY --from=client /build/dist /app/client/dist
RUN mkdir uploads generation-output && chown node:node uploads generation-output
USER node
EXPOSE 5000
CMD ["node", "src/index.js"]
