#!/bin/sh
# Neueste Version holen, bauen und starten (Migrationen laufen beim Start der App).
set -e
cd /opt/mb-dashboard/app
git pull -q
docker compose --env-file /opt/mb-dashboard/secrets.env -f deploy/docker-compose.yml up -d --build
docker image prune -f >/dev/null
echo "Läuft: $(git log --oneline -1)"
