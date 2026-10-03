#!/bin/sh
# Tägliche Datenbank-Sicherung (per Cron), 30 Tage aufbewahren.
set -e
DIR=/opt/mb-dashboard/backups
mkdir -p "$DIR"
cd /opt/mb-dashboard/app
docker compose --env-file /opt/mb-dashboard/secrets.env -f deploy/docker-compose.yml exec -T db pg_dump -U mb -d mb --no-owner | gzip > "$DIR/mb-$(date +%Y%m%d-%H%M).sql.gz"
chmod 600 "$DIR"/*.sql.gz
find "$DIR" -name 'mb-*.sql.gz' -mtime +30 -delete
