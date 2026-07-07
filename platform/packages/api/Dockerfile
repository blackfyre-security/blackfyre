FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN npm ci --workspace=packages/shared --workspace=packages/api
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/api

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/
EXPOSE 4000
CMD ["node", "packages/api/dist/index.js"]
