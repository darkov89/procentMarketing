#!/bin/bash
# Start Procent Marketing Lead Machine Next.js web application
set -e

cd "$(dirname "$0")/web"
echo "🚀 Uruchamianie Lead Machine 2.0 (Next.js / TypeScript / Neon)..."
echo "🌐 Aplikacja dostępna pod adresem: http://localhost:3000"
npm run dev
