#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "⚡ Faz Já — A iniciar..."
echo ""

# ── Node.js check ─────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js não encontrado."
  echo "   Instala em: https://nodejs.org (versão 18 ou superior)"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js 18+ necessário. Versão actual: $(node -v)"
  exit 1
fi

# ── .env setup ────────────────────────────────────────────────────────────────
if [ ! -f "$DIR/.env" ]; then
  echo "🔑 Primeira configuração..."
  echo ""
  if [ -f "$DIR/.env.example" ]; then
    cp "$DIR/.env.example" "$DIR/.env"
  fi
  read -rp "   Anthropic API key (começa com sk-ant-): " APIKEY
  echo ""
  # Write or replace key in .env
  if grep -q "ANTHROPIC_API_KEY=" "$DIR/.env" 2>/dev/null; then
    sed -i.bak "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${APIKEY}|" "$DIR/.env" && rm -f "$DIR/.env.bak"
  else
    echo "ANTHROPIC_API_KEY=${APIKEY}" >> "$DIR/.env"
  fi
fi

# ── npm install ───────────────────────────────────────────────────────────────
echo "📦 A verificar dependências..."
cd "$DIR/backend"
npm install --silent 2>&1 | grep -v "^npm notice" || true
cd "$DIR"

# ── VAPID keys ────────────────────────────────────────────────────────────────
CURRENT_VAPID=$(grep "^VAPID_PUBLIC_KEY=" "$DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "")
if [ -z "$CURRENT_VAPID" ] || [ "$CURRENT_VAPID" = "" ]; then
  echo "🔔 A gerar chaves VAPID para notificações..."
  node --input-type=module <<VAPID_SCRIPT
import webpush from '${DIR}/backend/node_modules/web-push/src/index.js';
import { readFileSync, writeFileSync } from 'fs';

const keys   = webpush.generateVAPIDKeys();
const envPath = '${DIR}/.env';
let env = readFileSync(envPath, 'utf8');

env = env.split('\n')
  .filter(l => !l.startsWith('VAPID_PUBLIC_KEY=') && !l.startsWith('VAPID_PRIVATE_KEY=') && !l.startsWith('VAPID_EMAIL='))
  .join('\n').trim();

env += '\nVAPID_PUBLIC_KEY='  + keys.publicKey;
env += '\nVAPID_PRIVATE_KEY=' + keys.privateKey;
env += '\nVAPID_EMAIL=mailto:fazja@local.app';
writeFileSync(envPath, env.trim() + '\n');
console.log('   ✅ Chaves VAPID geradas!');
VAPID_SCRIPT
fi

# ── Detect local IP ───────────────────────────────────────────────────────────
if command -v ipconfig &>/dev/null; then
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
elif command -v hostname &>/dev/null; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
else
  LOCAL_IP="localhost"
fi

PORT=$(grep "^PORT=" "$DIR/.env" 2>/dev/null | cut -d'=' -f2 || echo "3001")
PORT=${PORT:-3001}

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅ Faz Já pronto!                                   ║"
echo "║                                                      ║"
printf "║  📱 Abre no Android:  http://%-24s║\n" "${LOCAL_IP}:${PORT}"
echo "║                                                      ║"
echo "║  ⭐ Adicionar ao ecrã inicial (Chrome Android):       ║"
echo "║     ⋮ (menu) → 'Adicionar ao ecrã inicial'          ║"
echo "║                                                      ║"
echo "║  🔔 Para notificações push (Chrome Android):          ║"
echo "║     chrome://flags → pesquisa 'insecure origins'    ║"
echo "║     → activa → adiciona http://${LOCAL_IP}:${PORT}    ║"
echo "║     Reinicia o Chrome e aceita as notificações.     ║"
echo "║                                                      ║"
echo "║  🎤 Voz pode precisar de HTTPS. Alternativa:         ║"
echo "║     chrome://flags → 'Unsafely treat origins'       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  A correr... Ctrl+C para parar."
echo ""

# ── Start server ──────────────────────────────────────────────────────────────
node "$DIR/backend/server.js"
