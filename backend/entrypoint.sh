#!/bin/sh
set -e

echo "=== [ENTRYPOINT] Verifica e applicazione migrazioni del database ==="
# Esegue lo script di migrazione Drizzle.
# Se le tabelle non esistono o ci sono nuove migrazioni, le applica atomicamente in transazione.
if [ -f "dist/db/migrate.js" ]; then
  echo "[ENTRYPOINT] Esecuzione: node dist/db/migrate.js"
  node dist/db/migrate.js || {
    echo "[ERRORE CRITICO] Migrazione database fallita. Interruzione avvio per proteggere i dati."
    exit 1
  }
  echo "=== [ENTRYPOINT] Migrazioni completate con successo ==="
else
  echo "[ENTRYPOINT] dist/db/migrate.js non ancora presente. Salto migrazioni automatiche."
fi

echo "=== [ENTRYPOINT] Avvio server API Fastify (Node.js) ==="
exec node dist/index.js
