#!/usr/bin/env bash
# Envia o projeto inteiro para o servidor e rebuilda o container
set -euo pipefail

LOCAL="${LOCAL:-/Users/yanguimaraesviana/Desktop/website-manager/}"
REMOTE="${REMOTE:-root@yanserver.ddns.net:/pendriver/website-manager/}"

echo "→ Enviando projeto..."
rsync -avz --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$LOCAL" \
  "$REMOTE"

echo "→ Rebuild no servidor..."
ssh -o StrictHostKeyChecking=no "${REMOTE%%:*}" \
  "sh /pendriver/website-manager/scripts/up.sh"

echo "→ Deploy concluído."
