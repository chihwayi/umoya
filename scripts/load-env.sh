#!/bin/bash

# Get the directory of the current script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$DIR/.."

# Load environment variables from .env if present
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  source "$PROJECT_ROOT/.env"
  set +a
elif [ -f ".env" ]; then
    set -a
    source ".env"
    set +a
fi

export API_BASE_URL="${REACT_APP_EHR_API_URL}"

if [ -z "$API_BASE_URL" ]; then
  echo "Error: REACT_APP_EHR_API_URL environment variable is not set."
  echo "Please create a .env file with REACT_APP_EHR_API_URL defined."
  exit 1
fi

export FHIR_BASE_URL="${API_BASE_URL}/fhir"
# Derive service root URL (remove /api suffix if present)
export EHR_SERVICE_URL="${API_BASE_URL%/api}"

# Default host to localhost if not set
DEFAULT_HOST="${HOST:-localhost}"

# Export other service URLs with defaults if not set
export TENANT_SERVICE_URL="${REACT_APP_TENANT_API_URL:-http://${DEFAULT_HOST}:${PORT_TENANT_SERVICE:-3001}}"
export CDSS_SERVICE_URL="${REACT_APP_CDSS_API_URL:-http://${DEFAULT_HOST}:${PORT_CDSS_SERVICE:-8000}}"
export ELASTICSEARCH_URL="http://${DEFAULT_HOST}:${PORT_ELASTICSEARCH:-9200}"
export SNOWSTORM_URL="http://${DEFAULT_HOST}:${PORT_SNOWSTORM:-8080}"
export WHISPER_SERVICE_URL="http://${DEFAULT_HOST}:${PORT_WHISPER:-8001}"
