#!/usr/bin/env bash
# Skrypt uruchamiający panel UI Lead Machine
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
    echo "Brak środowiska .venv! Uruchom najpierw instalację: ~/.local/bin/uv venv --python 3.12"
    exit 1
fi

echo "▶ Uruchamianie panelu Lead Machine na http://localhost:8501 ..."
echo "💡 Aby udostępnić panel online przez Cloudflare, uruchom: ./run_cloudflare_tunnel.sh"
./.venv/bin/streamlit run leadmachine/ui/app.py --server.port 8501
