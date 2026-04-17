#!/usr/bin/env bash
set -euo pipefail

LEDGER_API="${CANTON_LEDGER_API_URL:-http://localhost:7575}"
DAR_FILE="$(dirname "$0")/.daml/dist/settlement-guard-1.0.0.dar"

echo "==> Canton SettlementGuard Setup"
echo "    Ledger API: $LEDGER_API"

wait_healthy() {
  echo -n "    Waiting for Canton sandbox to be healthy"
  for i in $(seq 1 30); do
    if curl -sf "$LEDGER_API/livez" > /dev/null 2>&1; then
      echo " OK"
      return 0
    fi
    echo -n "."
    sleep 2
  done
  echo " TIMED OUT"
  exit 1
}

allocate_party() {
  local hint="$1"
  curl -sf "$LEDGER_API/v2/parties/allocate" \
    -H "Content-Type: application/json" \
    -d "{\"partyIdHint\":\"${hint}\",\"identityProviderId\":\"\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['partyDetails']['party'])"
}

upload_dar() {
  echo "==> Uploading DAR: $DAR_FILE"
  if [ ! -f "$DAR_FILE" ]; then
    echo "ERROR: DAR not found at $DAR_FILE. Run 'dpm build' inside canton/ first (or 'dpm build --all' to also build tests)."
    exit 1
  fi

  curl -sf "$LEDGER_API/v2/packages/upload" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$DAR_FILE" > /dev/null

  echo "    DAR uploaded"
}

get_package_id() {
  dpm damlc inspect-dar --json "$DAR_FILE" \
    | python3 -c "import sys, json; print(json.load(sys.stdin)['main_package_id'])"
}

wait_healthy

echo "==> Allocating Canton parties"
SUBMITTER=$(allocate_party "sg-submitter")
CUSTODIAN=$(allocate_party "sg-custodian")
echo "    Submitter : $SUBMITTER"
echo "    Custodian : $CUSTODIAN"

upload_dar

PKG_ID=$(get_package_id)
echo "==> Package ID: $PKG_ID"

ENV_FILE="$(dirname "$0")/../backend/.env.canton"
cat > "$ENV_FILE" <<EOF
CANTON_LEDGER_API_URL=${LEDGER_API}
CANTON_SUBMITTER_PARTY=${SUBMITTER}
CANTON_CUSTODIAN_PARTY=${CUSTODIAN}
CANTON_PACKAGE_ID=${PKG_ID}
CANTON_DOMAIN=local-sandbox
CANTON_PARTICIPANT=sg-participant-01
EOF

echo ""
echo "==> Canton env written to: $ENV_FILE"
echo "    Source it before starting the backend:"
echo "    set -a && source backend/.env.canton && set +a"
echo ""
echo "Done."
