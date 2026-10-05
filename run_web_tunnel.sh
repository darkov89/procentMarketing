#!/usr/bin/env bash
# Uruchamia aplikację Lead Machine Next.js (port 3000) oraz bezpieczny tunel Cloudflare HTTPS
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

CLOUDFLARED="$DIR/.venv/bin/cloudflared"

if [ ! -f "$CLOUDFLARED" ]; then
    echo "Pobieranie binarnego pliku cloudflared..."
    mkdir -p "$DIR/.venv/bin"
    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz -o /tmp/cloudflared.tgz
    tar -xzf /tmp/cloudflared.tgz -C "$DIR/.venv/bin/"
    chmod +x "$CLOUDFLARED"
fi

# Sprawdź czy Next.js działa na porcie 3000
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "▶ Uruchamianie aplikacji Next.js w tle na porcie 3000..."
    cd "$DIR/web"
    npm run start > /tmp/leadmachine_web.log 2>&1 &
    WEB_PID=$!
    sleep 3
    cd "$DIR"
fi

echo "=========================================================="
echo "⚡ PROCENT MARKETING - CLOUDFLARE TUNNEL ONLINE"
echo "Tworzenie bezpiecznego tunelu HTTPS dla Next.js (port 3000)..."
echo "Zaraz pojawi się Twój unikalny publiczny adres URL (.trycloudflare.com)"
echo "=========================================================="
"$CLOUDFLARED" tunnel --url http://localhost:3000
