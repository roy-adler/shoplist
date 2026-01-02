# Multi-stage build for combined frontend + backend image

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci --only=production=false

COPY frontend/ .

# Build argument for API URL (defaults to /api for relative URLs)
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the React app
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:18-alpine AS backend-deps

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Final image with both frontend and backend
FROM node:18-alpine

# Install nginx, supervisor, and wget (for healthchecks) to run both services
RUN apk add --no-cache nginx supervisor wget && \
    mkdir -p /var/log/supervisor /etc/supervisor/conf.d

WORKDIR /app

# Copy backend dependencies and code
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Create nginx configuration
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /app/frontend/build; \
    index index.html; \
    \
    # Proxy API requests to backend running on localhost:5001 \
    location /api { \
        proxy_pass http://localhost:5001; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
        proxy_set_header X-Forwarded-Proto $scheme; \
    } \
    \
    # Serve static files and handle React Router \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/http.d/default.conf

# Create supervisor configuration to run both nginx and node
RUN echo '[supervisord] \
nodaemon=true \
user=root \
\
[program:nginx] \
command=nginx -g "daemon off;" \
autostart=true \
autorestart=true \
stderr_logfile=/var/log/supervisor/nginx.err.log \
stdout_logfile=/var/log/supervisor/nginx.out.log \
\
[program:backend] \
command=node /app/backend/server.js \
directory=/app/backend \
user=nodejs \
autostart=true \
autorestart=true \
stderr_logfile=/var/log/supervisor/backend.err.log \
stdout_logfile=/var/log/supervisor/backend.out.log \
environment=NODE_ENV="production",PORT="5001" \
' > /etc/supervisor/conf.d/supervisord.conf

# Create non-root user for backend (nginx runs as root by default in alpine)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app/backend

EXPOSE 80

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
