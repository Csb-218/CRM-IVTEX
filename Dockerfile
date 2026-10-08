# ---------------------------------------------------
# Stage 1: Build stage
# ---------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package definition files
COPY package*.json ./

# Install all dependencies for compiling TypeScript
RUN npm ci

# Copy configuration and source files
COPY tsconfig.json ./
COPY src ./src

# Build production bundle
RUN npm run build

# ---------------------------------------------------
# Stage 2: Production stage
# ---------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=8000

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Use built-in unprivileged node user
USER node

# Expose default application port
EXPOSE 8000

# Start server
CMD ["node", "dist/index.js"]
