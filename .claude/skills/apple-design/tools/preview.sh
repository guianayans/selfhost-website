#!/usr/bin/env bash
# Roda preview.cjs com um Node 20+ (o Playwright exige). Se o Node da máquina for mais antigo,
# copia uma vez o binário da imagem Docker node:22 para ~/.cache/apple-design/ e usa esse.
# Uso: preview.sh sites/meu-site [--out pasta] [--steps 8] [--serve]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NODE="$(command -v node || true)"
major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

if [ -z "$NODE" ] || [ "$(major "$NODE")" -lt 20 ]; then
  NODE="$HOME/.cache/apple-design/node22"
  if [ ! -x "$NODE" ]; then
    command -v docker >/dev/null || { echo "precisa de Node 20+ ou de Docker para obter um" >&2; exit 2; }
    mkdir -p "$(dirname "$NODE")"
    ID="$(docker create node:22)"
    docker cp "$ID:/usr/local/bin/node" "$NODE" >/dev/null
    docker rm "$ID" >/dev/null
  fi
fi
exec "$NODE" "$HERE/preview.cjs" "$@"
