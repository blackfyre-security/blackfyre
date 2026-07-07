FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/admin/package.json packages/admin/
RUN npm ci --workspace=packages/shared --workspace=packages/admin
COPY packages/shared/ packages/shared/
COPY packages/admin/ packages/admin/
RUN npm run build --workspace=packages/shared && npm run build --workspace=packages/admin

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/admin/.next/standalone ./
COPY --from=builder /app/packages/admin/.next/static ./packages/admin/.next/static
COPY --from=builder /app/packages/admin/public ./packages/admin/public
EXPOSE 3003
CMD ["node", "packages/admin/server.js"]
