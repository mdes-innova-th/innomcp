FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      make \
      g++ \
      libcairo2-dev \
      libpango1.0-dev \
      libjpeg-dev \
      libgif-dev \
      librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifest first for better caching.
# The checked-in npm lockfile points at parent pnpm symlinks, which are invalid
# inside this isolated Docker build context.
COPY package.json ./

# Install all dependencies for build, including TypeScript even when the lockfile omits dev deps.
RUN npm install --include=dev --package-lock=false && npm install --no-save --package-lock=false typescript @types/node

# Copy the rest of the application
COPY . .

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      libcairo2 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libjpeg62-turbo \
      libgif7 \
      librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Create and use non-root user for security
RUN groupadd --system appgroup \
    && useradd --system --gid appgroup --create-home appuser \
    && mkdir -p /app/logs /app/data /logs /workspace-storage \
    && chown -R appuser:appgroup /app/logs /app/data /logs /workspace-storage
USER appuser

EXPOSE 3012

CMD ["node", "dist/server.js"]
