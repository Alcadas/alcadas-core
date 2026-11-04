#!/bin/sh
set -e

# Garante que as dependencias essenciais do Nx estejam presentes
if [ ! -d "/app/node_modules/@nx" ]; then
  echo "📦 Sincronizando node_modules na inicialização..."
  npm ci --prefer-offline --no-audit
fi

exec "$@"
