#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Docker Compose is required."
  exit 1
fi

SERVICES=("$@")
if [ ${#SERVICES[@]} -eq 0 ]; then
  SERVICES=(
    postgres-master
    redis
    minio
    tenant-service
    cdss-service
    cdss-worker
    ehr-service
    web-app
    ehr-frontend
    patient-portal
    prometheus
    grafana
  )
fi

echo "Deploying services: ${SERVICES[*]}"
"${COMPOSE_CMD[@]}" up -d --build "${SERVICES[@]}"
echo "Deployment complete."
