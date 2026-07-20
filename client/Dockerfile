# Dockerfile for Next.js 15 Frontend
FROM node:20-alpine AS base

# Step 1: Install dependencies only when needed
FROM base AS deps
RUN apk add --no-libc-compat libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Step 2: Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Environment variables for build time (e.g., API base URL)
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_DEMO_MODE=false

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE

RUN npm run build

# Step 3: Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
