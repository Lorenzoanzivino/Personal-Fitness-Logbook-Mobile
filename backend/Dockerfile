# =====================================================================
# DOCKERFILE MULTI-STAGE ULTRA-LEGGERO PER FASTIFY + DRIZZLE
# Immagine finale basata su node:20-alpine (< 150 MB dimensione immagine)
# =====================================================================

# ---------------------------------------------------------------------
# STAGE 1: Compilazione TypeScript
# ---------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Dipendenze package per la build
COPY package*.json tsconfig.json ./
RUN npm ci

# Copia codice sorgente backend
COPY src/ ./src
COPY drizzle/ ./drizzle
COPY drizzle.config.ts ./

# Compilazione TypeScript in JavaScript ottimizzato (dist/)
RUN npm run build

# ---------------------------------------------------------------------
# STAGE 2: Runtime di Produzione (Lean & Hardened)
# ---------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Limita heap memoria V8 a 192 MB per rispettare il tetto di 250 MB di Docker
ENV NODE_OPTIONS="--max-old-space-size=192"

# Installazione esclusiva dipendenze di produzione
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copia artefatti compilati dallo Stage 1
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY entrypoint.sh ./entrypoint.sh

# Permessi di esecuzione e directory per upload PDF
RUN chmod +x ./entrypoint.sh && mkdir -p /app/uploads

EXPOSE 8000

# Healthcheck interno del container
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
