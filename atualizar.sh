#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
python3 -m pip install -r requirements.txt --quiet
python3 scripts/atualizar_dados.py && { command -v xdg-open >/dev/null && xdg-open index.html || open index.html 2>/dev/null; }
