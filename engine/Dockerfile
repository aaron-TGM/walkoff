# Moment engine image for Cloud Run. Build from the repo root:
#   docker build -f engine/Dockerfile -t walkoff-engine .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY lib ./lib
COPY engine ./engine
RUN npm run engine:build

# The bundle includes its dependencies, so the runtime image needs no npm.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/engine.cjs ./engine.cjs
USER node
EXPOSE 8080
CMD ["node", "engine.cjs"]
