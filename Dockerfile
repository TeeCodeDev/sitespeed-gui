# Stage 1: Build Frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:24-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DB_PATH=/data/db/sitespeed.sqlite
ENV RESULTS_DIR=/data/results
ENV FRONTEND_DIST_DIR=/app/frontend/dist

COPY --from=backend-builder /app/backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

RUN mkdir -p /data/db /data/results
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "dist/server.js"]
