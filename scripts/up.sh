#!/usr/bin/env sh
# Sobe o app no servidor — pode rodar de qualquer pasta
set -e

ROOT="/pendriver/website-manager"
cd "$ROOT"

sh "$ROOT/scripts/check-deploy.sh"
docker compose up -d --build

echo ""
docker compose ps
curl -sf "http://127.0.0.1:4050/health" && echo ""
