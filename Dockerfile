FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-slim AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./server/
COPY scripts/ ./scripts/

RUN mkdir -p server/public/generated scripts/pending scripts/printed

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/src/index.js"]
