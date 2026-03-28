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

trim() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

strip_trailing_slash() {
  printf '%s' "$1" | sed 's#/*$##'
}

ensure_leading_slash() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '/%s' "$1" ;;
  esac
}

join_url() {
  local base path
  base="$(strip_trailing_slash "$1")"
  path="$(ensure_leading_slash "$2")"
  printf '%s%s' "$base" "$path"
}

resolve_url() {
  local explicit base path
  explicit="$(trim "$1")"
  base="$(trim "$2")"
  path="$3"

  if [ -n "$explicit" ]; then
    printf '%s' "$explicit"
    return 0
  fi

  if [ -n "$base" ]; then
    join_url "$base" "$path"
    return 0
  fi

  return 1
}

if [ -z "$API_BASE_URL" ]; then
  API_BASE_URL="$(resolve_url "${REACT_APP_EHR_API_URL}" "${REACT_APP_API_BASE_URL:-$SERVICE_BASE_URL}" "${REACT_APP_EHR_API_PATH:-/ehr-service/api}" || true)"
fi

if [ -z "$API_BASE_URL" ]; then
  echo "Error: EHR API URL is not configured."
  echo "Set REACT_APP_EHR_API_URL or use REACT_APP_API_BASE_URL/SERVICE_BASE_URL with REACT_APP_EHR_API_PATH."
  exit 1
fi

export FHIR_BASE_URL="${API_BASE_URL}/fhir"
# Derive service root URL (remove /api suffix if present)
export EHR_SERVICE_URL="$(resolve_url "${SERVICE_EHR_URL}" "${SERVICE_BASE_URL}" "${SERVICE_EHR_PATH:-/ehr-service}" || printf '%s' "${API_BASE_URL%/api}")"
export TENANT_SERVICE_URL="$(resolve_url "${SERVICE_TENANT_URL:-$REACT_APP_TENANT_API_URL}" "${REACT_APP_API_BASE_URL:-$SERVICE_BASE_URL}" "${REACT_APP_TENANT_API_PATH:-/tenant-service/api}" || true)"
export CDSS_SERVICE_URL="$(resolve_url "${SERVICE_CDSS_URL:-$REACT_APP_CDSS_API_URL}" "${REACT_APP_API_BASE_URL:-$SERVICE_BASE_URL}" "${REACT_APP_CDSS_API_PATH:-/cdss-service}" || true)"
export ELASTICSEARCH_URL="${ELASTICSEARCH_URL:-}"
export SNOWSTORM_URL="${SNOWSTORM_URL:-}"
export WHISPER_SERVICE_URL="${WHISPER_SERVICE_URL:-}"
