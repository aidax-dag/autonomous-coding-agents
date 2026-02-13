# ==============================================
# ACA Web Dashboard - Multi-stage Build
# ==============================================
# Stage 1: Build React app with Vite
# Stage 2: Serve static files with nginx

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build-time variables
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Build the production bundle
RUN npm run build

# ---- Production Stage ----
FROM nginx:1.27-alpine AS production

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user for nginx
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
