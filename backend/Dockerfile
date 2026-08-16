FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY backend/prisma ./prisma
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN pnpm prisma:generate && pnpm build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --chown=node:node backend/package.json backend/pnpm-lock.yaml backend/pnpm-workspace.yaml ./
COPY --chown=node:node frontend/showroom/assets /frontend/showroom/assets
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

