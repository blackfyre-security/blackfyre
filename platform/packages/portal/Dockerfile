FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/portal/package.json packages/portal/
RUN npm ci --workspace=packages/shared --workspace=packages/portal
COPY packages/shared/ packages/shared/
COPY packages/portal/ packages/portal/
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/portal

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/portal/.next/standalone ./
COPY --from=builder /app/packages/portal/.next/static ./packages/portal/.next/static
COPY --from=builder /app/packages/portal/public ./packages/portal/public
EXPOSE 3001
CMD ["node", "packages/portal/server.js"]
