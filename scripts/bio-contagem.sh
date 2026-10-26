#!/usr/bin/env sh
# Gera sites/bio/contagem.json com os números do topo do site bio:
#   apps      → apps meus rodando agora no Docker (um por projeto do compose)
#   total     → repositórios no GitHub, públicos + privados (precisa do gh logado)
#   linguagens→ linguagem principal de cada repositório, com quantos repositórios usam cada uma
# Só números vão para o arquivo; nenhum nome de app ou de repositório privado.
# Uso: sh scripts/bio-contagem.sh [usuario-github]
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
USUARIO="${1:-guianayans}"
SAIDA="$ROOT/sites/bio/contagem.json"

# Imagens que não são app meu: bancos, cache, proxy, monitoramento, Coolify e serviços de terceiros.
# Um projeto do compose só conta se tiver pelo menos um container fora desta lista.
# Bancos avulsos criados pelo Coolify (pasta /data/coolify/databases) também ficam de fora.
TERCEIROS='postgres|postgis|redis|mysql|mariadb|mongo|traefik|haproxy|prometheus|node-exporter|n8n|busybox|coollabsio/|wg-easy|linuxserver/wireguard|evolution-api'

APPS=$(docker ps --filter status=running --format '{{.Label "com.docker.compose.project"}}|{{.Image}}|{{.Label "com.docker.compose.project.working_dir"}}' \
  | grep -vE "^\|" \
  | grep -v "|/data/coolify/databases/" \
  | grep -vE "\|.*($TERCEIROS)" \
  | cut -d'|' -f1 | sort -u | wc -l)

gh repo list "$USUARIO" --limit 1000 --json isFork,primaryLanguage -q "
  [.[] | select(.isFork | not)] as \$r
  | {
      apps: $APPS,
      total: (\$r | length),
      linguagens: ([\$r[].primaryLanguage.name | select(. != null)] | group_by(.) | map({nome: .[0], repos: length}) | sort_by(-.repos)),
      atualizado: (now | todate)
    }" > "$SAIDA.tmp"
mv "$SAIDA.tmp" "$SAIDA"
cat "$SAIDA"
