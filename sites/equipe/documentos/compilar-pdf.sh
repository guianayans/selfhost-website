#!/usr/bin/env bash
# Compila documentos/latex/*.tex em documentos/*.pdf com o TeX Live oficial em Docker
# (não precisa de LaTeX instalado). Rode antes: node docs/equipe/documentos/gerar-latex.mjs
set -euo pipefail
cd "$(dirname "$0")"
# Imagem com os pacotes já instalados (latex/Dockerfile); construída na 1ª vez.
docker image inspect estadia-texlive:1 >/dev/null 2>&1 || docker build -q -t estadia-texlive:1 latex >/dev/null
docker run --rm -v "$PWD":/w -w /w/latex estadia-texlive:1 sh -c '
  for f in *.tex; do
    for passada in 1 2; do
      pdflatex -interaction=nonstopmode -halt-on-error "$f" >/dev/null || { echo "ERRO em $f:"; grep -A3 "^!" "${f%.tex}.log" | head -20; exit 1; }
    done
    mv "${f%.tex}.pdf" ../
    echo "pdf: ${f%.tex}.pdf"
  done
  rm -f *.aux *.log *.out
'
