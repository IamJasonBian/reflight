#!/usr/bin/env bash
# Local dev environment bootstrap
# Usage: ./scripts/dev-setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}▶ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# 1. Copy env files if missing
if [ ! -f ".env" ]; then
  cp .env.example .env
  warn ".env created from .env.example — add your CLERK keys before running the API"
fi

if [ ! -f "artifacts/branchwing/.env" ]; then
  cp artifacts/branchwing/.env.example artifacts/branchwing/.env
  warn "branchwing/.env created — add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY before starting the app"
fi

# 2. Install dependencies
log "Installing dependencies..."
pnpm install --frozen-lockfile

# 3. Start Postgres if Docker is available
if command -v docker &>/dev/null; then
  log "Starting Postgres via Docker..."
  docker compose up -d postgres
  log "Waiting for Postgres to be ready..."
  until docker compose exec postgres pg_isready -U reflight -q 2>/dev/null; do
    sleep 1
  done
  log "Postgres ready"
else
  warn "Docker not found — make sure DATABASE_URL in .env points to a running Postgres instance"
fi

# 4. Run migrations
log "Running database migrations..."
set -a && source .env && set +a
pnpm --filter @workspace/db run migrate

log "Done! Start services:"
echo "  API server:  pnpm --filter @workspace/api-server run dev"
echo "  Expo app:    cd artifacts/branchwing && pnpm exec expo start"
echo "  Expo tunnel: cd artifacts/branchwing && pnpm exec expo start --tunnel"
