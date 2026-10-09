#!/usr/bin/env bash
# Prepara um vídeo para seguir a rolagem (video[data-scrub]) e, se pedido, a sequência de imagens
# (canvas[data-frames]). Uso:
#   make-scrub.sh entrada.mp4 sites/meu-site/assets/hero            -> hero.mp4 + hero-poster.webp
#   make-scrub.sh entrada.mp4 sites/meu-site/assets/hero --frames 120 -> também hero/f_0001.webp ... f_0120.webp
# Variáveis: WIDTH (largura final, padrão 1600), CRF (qualidade do mp4, padrão 24), Q (qualidade do webp, padrão 72).
set -euo pipefail

IN="${1:?uso: make-scrub.sh entrada saida-sem-extensao [--frames N]}"
OUT="${2:?uso: make-scrub.sh entrada saida-sem-extensao [--frames N]}"
FRAMES=0
[ "${3:-}" = "--frames" ] && FRAMES="${4:?--frames precisa de um número}"
WIDTH="${WIDTH:-1600}"; CRF="${CRF:-24}"; Q="${Q:-72}"
SCALE="scale='min(${WIDTH},iw)':-2:flags=lanczos"

mkdir -p "$(dirname "$OUT")"

# Todo quadro é quadro-chave (-g 1): o navegador pula para qualquer instante sem decodificar os
# vizinhos, que é o que deixa a rolagem lisa, inclusive para trás. Sem áudio; faststart para tocar
# antes de baixar tudo.
ffmpeg -y -loglevel error -i "$IN" -an -vf "$SCALE" \
  -c:v libx264 -preset slow -crf "$CRF" -g 1 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart "$OUT.mp4"
ffmpeg -y -loglevel error -i "$IN" -frames:v 1 -vf "$SCALE" -q:v "$Q" "$OUT-poster.webp"
echo "vídeo:  $OUT.mp4 ($(du -h "$OUT.mp4" | cut -f1))"

if [ "$FRAMES" -gt 0 ]; then
  DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")"
  mkdir -p "$OUT"
  ffmpeg -y -loglevel error -i "$IN" -an -vf "fps=${FRAMES}/${DUR},$SCALE" -frames:v "$FRAMES" -c:v libwebp -q:v "$Q" -f image2 "$OUT/f_%04d.webp"
  N="$(find "$OUT" -name 'f_*.webp' | wc -l)"
  echo "quadros: $OUT/f_%04d.webp — data-count=\"$N\" ($(du -sh "$OUT" | cut -f1))"
fi
