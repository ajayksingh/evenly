#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# monitor.sh
# Background file watcher. Polls tracked spec and source files every 30s.
# When a change is detected, triggers the orchestrator automatically.
#
# Usage:
#   bash scripts/monitor.sh &          # run in background
#   bash scripts/monitor.sh --once     # single check, then exit
#   kill %1                            # stop background monitor
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POLL_INTERVAL=30
HASH_STORE="/tmp/evenly_monitor_hashes"
ONCE=false

[ "${1:-}" = "--once" ] && ONCE=true

# ── Files to track ────────────────────────────────────────────────────────────
TRACKED_FILES=(
  "app.json"
  "package.json"
  "eas.json"
  "src/services/storage.js"
  "src/services/ads.js"
  "src/utils/splitCalculator.js"
  "src/context/AppContext.js"
  "src/screens/AddExpenseScreen.js"
  "src/screens/SettleUpScreen.js"
  "src/screens/HomeScreen.js"
  "src/screens/GroupDetailScreen.js"
  "maestro/flows/02_user_a_create_group_and_add_expense.yaml"
  "maestro/flows/03_add_member_and_second_expense.yaml"
  "maestro/flows/04_settle_payment.yaml"
  "maestro/flows/05_user_a_verify_settlement.yaml"
)

# ── Compute hash of all tracked files ────────────────────────────────────────
compute_hashes() {
  for f in "${TRACKED_FILES[@]}"; do
    local full="$REPO_ROOT/$f"
    if [ -f "$full" ]; then
      echo "$(md5 -q "$full" 2>/dev/null || md5sum "$full" | cut -d' ' -f1) $f"
    fi
  done
}

# ── Save initial snapshot ─────────────────────────────────────────────────────
snapshot() {
  compute_hashes > "$HASH_STORE"
}

# ── Compare current state to snapshot ────────────────────────────────────────
changed_files() {
  local current
  current=$(compute_hashes)
  local prev
  prev=$(cat "$HASH_STORE" 2>/dev/null || echo "")

  # Files that exist now but differ from snapshot
  while IFS= read -r line; do
    local hash file
    hash=$(echo "$line" | cut -d' ' -f1)
    file=$(echo "$line" | cut -d' ' -f2)
    local prev_hash
    prev_hash=$(grep " $file$" "$HASH_STORE" 2>/dev/null | cut -d' ' -f1 || echo "")
    if [ "$hash" != "$prev_hash" ]; then
      echo "$file"
    fi
  done <<< "$current"
}

# ── Main loop ─────────────────────────────────────────────────────────────────
echo "[monitor] Starting — polling every ${POLL_INTERVAL}s"
echo "[monitor] Tracking ${#TRACKED_FILES[@]} files in $REPO_ROOT"

# Take initial snapshot
snapshot
echo "[monitor] Baseline snapshot taken."

if [ "$ONCE" = true ]; then
  sleep 2
  CHANGED=$(changed_files)
  if [ -n "$CHANGED" ]; then
    echo "[monitor] Changes detected:"
    echo "$CHANGED" | sed 's/^/  • /'
    for f in $CHANGED; do
      bash "$REPO_ROOT/scripts/orchestrate.sh" --changed "$f"
    done
    snapshot
  else
    echo "[monitor] No changes detected."
  fi
  exit 0
fi

while true; do
  sleep "$POLL_INTERVAL"
  CHANGED=$(changed_files)
  if [ -n "$CHANGED" ]; then
    echo ""
    echo "[monitor] ⚡ Changes detected at $(date '+%H:%M:%S'):"
    echo "$CHANGED" | sed 's/^/  • /'
    echo "[monitor] Triggering orchestrator..."

    for f in $CHANGED; do
      bash "$REPO_ROOT/scripts/orchestrate.sh" --changed "$f"
    done

    # Update snapshot after handling
    snapshot
    echo "[monitor] Snapshot updated. Resuming watch..."
  fi
done
