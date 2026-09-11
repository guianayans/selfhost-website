#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

missing=0
for f in Dockerfile docker-compose.yml app/package.json app/server.js; do
  if [ ! -f "$f" ]; then
    echo "FALTANDO: $f"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Deploy incompleto. Envie o projeto INTEIRO, não só o docker-compose.yml."
  echo "Exemplo:"
  echo "  rsync -avz --delete -e ssh ./ user@servidor:/pendriver/website-manager/"
  exit 1
fi

echo "OK — arquivos de build presentes em $ROOT"
ls -la Dockerfile docker-compose.yml
