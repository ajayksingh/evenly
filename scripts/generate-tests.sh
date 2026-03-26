#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# generate-tests.sh  <changed_file>
# Gen-agent: inspects what changed and scaffolds new Maestro YAML flows for
# any new or modified functionality. Called by orchestrate.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLOWS_DIR="$REPO_ROOT/maestro/flows"
CHANGED="${1:-}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

echo "[gen-agent] Analyzing changed file: ${CHANGED:-'(none specified)'}"

if [ -z "$CHANGED" ]; then
  echo "[gen-agent] No specific file — skipping scenario generation."
  exit 0
fi

# ── Map changed file to test scenario ────────────────────────────────────────
flow_for_file() {
  local file="$1"
  case "$file" in
    src/screens/AddExpenseScreen.js)
      echo "auto_add_expense_regression"
      ;;
    src/screens/SettleUpScreen.js)
      echo "auto_settle_regression"
      ;;
    src/screens/GroupDetailScreen.js)
      echo "auto_group_detail_regression"
      ;;
    src/screens/HomeScreen.js)
      echo "auto_home_regression"
      ;;
    src/services/storage.js)
      echo "auto_storage_regression"
      ;;
    src/utils/splitCalculator.js)
      echo "auto_split_math_regression"
      ;;
    src/context/AppContext.js)
      echo "auto_context_regression"
      ;;
    *)
      echo ""
      ;;
  esac
}

FLOW_NAME=$(flow_for_file "$CHANGED")

if [ -z "$FLOW_NAME" ]; then
  echo "[gen-agent] No test template for: $CHANGED — skipping."
  exit 0
fi

OUTPUT="$FLOWS_DIR/${FLOW_NAME}.yaml"

# Don't overwrite existing manually-written flows
if [ -f "$OUTPUT" ]; then
  echo "[gen-agent] Flow already exists: $OUTPUT — skipping (won't overwrite manual flow)."
  exit 0
fi

echo "[gen-agent] Generating: $OUTPUT"

# ── Scaffold based on which file changed ─────────────────────────────────────
case "$FLOW_NAME" in

  auto_add_expense_regression)
    cat > "$OUTPUT" <<YAML
---
# AUTO-GENERATED — $(date '+%Y-%m-%d')
# Regression test for AddExpenseScreen modifications
# Triggered by change to: $CHANGED
# Review and complete before committing.
appId: com.ajayksingh.evenly
env:
  USER_EMAIL: deepsags@gmail.com
  USER_PASS: abc123
---
- launchApp:
    clearState: true
- extendedWaitUntil:
    visible: "Welcome back"
    timeout: 30000
- runFlow:
    file: ./helpers/do_login.yaml
    env:
      EMAIL: \${USER_EMAIL}
      PASS: \${USER_PASS}
- extendedWaitUntil:
    visible: "Total balance"
    timeout: 30000

# Navigate to an existing group or create one
- tapOn: "Groups"
- waitForAnimationToEnd

# TODO: Add group-specific setup if needed
# - tapOn: "<group name>"

# Open Add Expense
- tapOn: "Add"
- waitForAnimationToEnd
- assertVisible: "Add Expense"

# --- Equal split (baseline) ---
- tapOn:
    id: "expense-amount-input"
- inputText: "500"
- tapOn:
    id: "expense-description-input"
- inputText: "Auto regression test"
- tapOn:
    id: "expense-save-btn"
- waitForAnimationToEnd
- assertVisible: "Auto regression test"

# TODO: Add assertions for the specific change that was made
YAML
    ;;

  auto_settle_regression)
    cat > "$OUTPUT" <<YAML
---
# AUTO-GENERATED — $(date '+%Y-%m-%d')
# Regression test for SettleUpScreen modifications
# Triggered by change to: $CHANGED
# Review and complete before committing.
appId: com.ajayksingh.evenly
env:
  USER_EMAIL: deepsags@gmail.com
  USER_PASS: abc123
---
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible: "Total balance"
    timeout: 30000

# Navigate to Settle Up from Home
- tapOn: "Settle Up"
- waitForAnimationToEnd
- assertVisible: "Settle Up"

# Verify form elements render correctly
- assertVisible: "Who's paying?"
- assertVisible: "Who are they paying?"

# TODO: Add assertions for the specific change that was made
# TODO: Complete payer/receiver/amount selection and verify success screen
YAML
    ;;

  auto_split_math_regression)
    cat > "$OUTPUT" <<YAML
---
# AUTO-GENERATED — $(date '+%Y-%m-%d')
# Regression test for split calculation changes
# Triggered by change to: $CHANGED
# Review and complete before committing.
appId: com.ajayksingh.evenly
env:
  USER_EMAIL: deepsags@gmail.com
  USER_PASS: abc123
---
- launchApp:
    clearState: false
- extendedWaitUntil:
    visible: "Total balance"
    timeout: 30000
- tapOn: "Groups"
- waitForAnimationToEnd
- tapOn: "Add"
- waitForAnimationToEnd

# --- Equal split ---
- tapOn:
    id: "expense-amount-input"
- inputText: "300"
- tapOn:
    id: "expense-description-input"
- inputText: "Split math test - equal"
- tapOn:
    id: "expense-save-btn"
- waitForAnimationToEnd

# TODO: Verify balance amounts are mathematically correct
# TODO: Test percentage split (should sum to 100%)
# TODO: Test exact split (should sum to total +/- 0.01)
# TODO: Test shares split (proportional)
YAML
    ;;

  auto_home_regression)
    cat > "$OUTPUT" <<YAML
---
# AUTO-GENERATED — $(date '+%Y-%m-%d')
# Regression test for HomeScreen modifications
# Triggered by change to: $CHANGED
appId: com.ajayksingh.evenly
env:
  USER_EMAIL: deepsags@gmail.com
  USER_PASS: abc123
---
- launchApp:
    clearState: true
- extendedWaitUntil:
    visible: "Welcome back"
    timeout: 30000
- runFlow:
    file: ./helpers/do_login.yaml
    env:
      EMAIL: \${USER_EMAIL}
      PASS: \${USER_PASS}
- extendedWaitUntil:
    visible: "Total balance"
    timeout: 30000
- assertVisible: "Total balance"
# TODO: Add assertions specific to the HomeScreen change
YAML
    ;;

  *)
    cat > "$OUTPUT" <<YAML
---
# AUTO-GENERATED — $(date '+%Y-%m-%d')
# Regression test for: $CHANGED
# Complete this flow before merging.
appId: com.ajayksingh.evenly
---
- launchApp:
    clearState: true
# TODO: Add test steps for $CHANGED
YAML
    ;;
esac

echo "[gen-agent] ✓ Generated: $OUTPUT"
echo "[gen-agent] ⚠ Review and complete the TODO sections before committing this flow."
exit 0
