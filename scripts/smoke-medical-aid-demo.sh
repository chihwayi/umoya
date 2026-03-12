#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3004}"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required for JSON parsing in this smoke script"
  exit 1
fi

echo "[1/3] Checking health: ${BASE_URL}/health"
HEALTH_JSON="$(curl -fsS "${BASE_URL}/health")"
echo "Health OK"

MEMBER_NUMBER="${DEMO_MEMBER_NUMBER:-MED-1001}"
CLAIM_AMOUNT="${DEMO_CLAIM_AMOUNT:-250}"

echo "[2/3] Submitting claim for member ${MEMBER_NUMBER}"
CLAIM_RESPONSE="$(curl -fsS -X POST "${BASE_URL}/api/claims" \
  -H 'Content-Type: application/json' \
  -d "{\"memberNumber\":\"${MEMBER_NUMBER}\",\"claimAmount\":${CLAIM_AMOUNT},\"claimData\":{\"claimType\":\"outpatient\",\"source\":\"smoke-script\"}}")"

CLAIM_ID="$(printf '%s' "${CLAIM_RESPONSE}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(j.claimId||'');});")"
if [[ -z "${CLAIM_ID}" ]]; then
  echo "Failed to parse claim id from response"
  echo "Response: ${CLAIM_RESPONSE}"
  exit 1
fi

echo "Submitted claim: ${CLAIM_ID}"

echo "[3/3] Checking claim status"
STATUS_RESPONSE="$(curl -fsS "${BASE_URL}/api/claims/${CLAIM_ID}")"
STATUS="$(printf '%s' "${STATUS_RESPONSE}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(String(j.status||''));});")"
APPROVED_AMOUNT="$(printf '%s' "${STATUS_RESPONSE}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);process.stdout.write(String(j.approvedAmount??''));});")"

echo "Claim status: ${STATUS}"
echo "Approved amount: ${APPROVED_AMOUNT}"
echo "Smoke demo completed successfully."
