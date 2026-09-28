#!/usr/bin/env bash
# Uruchamia Streamlit oraz bezpieczny tunel Cloudflare z publicznym adresem HTTPS
cd "$(dirname "$0")"

CLOUDFLARED="./.venv/bin/cloudflared"

if [ ! -f "$CLOUDFLARED" ]; then
    echo "Pobieranie binarnego pliku cloudflared..."
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz -o /tmp/cloudflared.tgz
    tar -xzf /tmp/cloudflared.tgz -C .venv/bin/
    chmod +x "$CLOUDFLARED"
fi

# Sprawdź czy Streamlit działa
if ! curl -s http://localhost:8501 > /dev/null; then
    echo "▶ Uruchamianie Streamlit w tle na porcie 8501..."
    ./.venv/bin/streamlit run leadmachine/ui/app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true > /dev/null 2>&1 &
    sleep 3
fi

echo "=========================================================="
echo "⚡ PROCENT MARKETING - CLOUDFLARE TUNNEL ONLINE"
echo "Tworzenie bezpiecznego tunelu HTTPS dla portu 8501..."
echo "=========================================================="
"$CLOUDFLARED" tunnel --url http://localhost:8501
