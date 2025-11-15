FROM node:24.4.2-alpine3.21 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --fetch-timeout=50000000 --fetch-retries=5

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0

# ติดตั้ง iputils-ping เพื่อให้ container ใช้ ping ได้
# สำหรับ alpine-based images, we can use the following command
USER root
RUN apk add --no-cache iputils
# # สำหรับ node:24.4
# USER root
# RUN apt-get update && apt-get install -y iputils-ping

# Create non-root user for better security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Use non-root user for better security
# สำหรับ volume uploads
RUN mkdir -p /app/assets/uploads \
    && chown -R nextjs:nodejs /app/assets/uploads
USER nextjs

EXPOSE 3004
ENV PORT=3004

# Use the server file from the standalone output
CMD ["node", "server.js"]