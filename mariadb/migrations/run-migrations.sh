#!/usr/bin/env sh
set -e

echo "[db-migrate] waiting for mariadb..."
until mariadb -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1" >/dev/null 2>&1; do
  sleep 2
done

echo "[db-migrate] connected. running migrations..."
for f in /migrations/*.sql; do
  echo "[db-migrate] apply $f"
  mariadb -h "$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" < "$f"
done

echo "[db-migrate] done."
