
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client without connecting to a real database
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    ./node_modules/.bin/prisma generate

RUN npm run build

FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --chown=node:node --chmod=644 package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/generated ./generated
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/content ./content
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs

USER node

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
