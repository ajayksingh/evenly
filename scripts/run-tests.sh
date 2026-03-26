#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# run-tests.sh
# Runs the core Maestro E2E flows for expense creation and group settlement.
# Exits 0 on pass, 1 on failure.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

FLOWS_DIR="$(cd "$(dirname "$0")/.." && pwd)/maestro/flows"
RESULTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/maestro/results"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
REPORT="$RESULTS_DIR/report_${TIMESTAMP}.xml"

# Core flows that must pass — expense creation and settlement pipeline
CORE_FLOWS=(
  "00_setup_user_b.yaml"
  "02_user_a_create_group_and_add_expense.yaml"
  "03_add_member_and_second_expense.yaml"
  "04_settle_payment.yaml"
  "05_user_a_verify_settlement.yaml"
)

# ── Preflight checks ──────────────────────────────────────────────────────────
if ! command -v maestro &>/dev/null; then
  echo "✗ Maestro CLI not found. Install with: brew install maestro"
  exit 1
fi

# Detect connected device or running emulator
DEVICE=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1; exit}')
if [ -z "$DEVICE" ]; then
  echo "✗ No Android device or emulator found. Start one before running tests."
  exit 1
fi

echo "▶ Running core E2E tests on device: $DEVICE"
echo "  Flows: ${CORE_FLOWS[*]}"
echo ""

mkdir -p "$RESULTS_DIR"

PASSED=0
FAILED=0
FAILED_FLOWS=()

for flow in "${CORE_FLOWS[@]}"; do
  FLOW_PATH="$FLOWS_DIR/$flow"
  if [ ! -f "$FLOW_PATH" ]; then
    echo "  ⚠ Flow not found, skipping: $flow"
    continue
  fi

  echo -n "  ▷ $flow ... "
  if maestro --device "$DEVICE" test "$FLOW_PATH" --format junit --output "$RESULTS_DIR/result_${flow%.yaml}_${TIMESTAMP}.xml" 2>/dev/null; then
    echo "PASS ✓"
    PASSED=$((PASSED + 1))
  else
    echo "FAIL ✗"
    FAILED=$((FAILED + 1))
    FAILED_FLOWS+=("$flow")
  fi
done

echo ""
echo "─────────────────────────────────"
echo "  Results: $PASSED passed, $FAILED failed"
echo "─────────────────────────────────"

if [ ${#FAILED_FLOWS[@]} -gt 0 ]; then
  echo ""
  echo "✗ Failed flows:"
  for f in "${FAILED_FLOWS[@]}"; do
    echo "    • $f"
  done
  echo ""
  echo "✗ Tests FAILED — fix regressions before pushing."
  exit 1
fi

echo ""
echo "✓ All core tests passed. App is stable."
exit 0
