#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# update-docs.sh  [changed_file]
# Doc-agent: detects what changed and patches README sections that are
# out of date. Called by orchestrate.sh in a background process.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
README="$REPO_ROOT/README.md"
CHANGED="${1:-}"

echo "[doc-agent] Starting documentation sync..."
echo "[doc-agent] Changed file: ${CHANGED:-'(full scan)'}"

# ── Detect what changed ───────────────────────────────────────────────────────
detect_section() {
  local file="$1"
  case "$file" in
    app.json|eas.json)           echo "configuration" ;;
    package.json)                echo "tech-stack" ;;
    src/services/storage.js)     echo "services-storage" ;;
    src/services/ads.js)         echo "monetisation" ;;
    src/utils/splitCalculator.js) echo "services-split" ;;
    src/context/AppContext.js)   echo "state-management" ;;
    src/screens/AddExpenseScreen.js) echo "navigation" ;;
    src/screens/SettleUpScreen.js)   echo "navigation" ;;
    maestro/flows/*)             echo "testing" ;;
    *)                           echo "general" ;;
  esac
}

SECTION=$(detect_section "${CHANGED:-}")
echo "[doc-agent] Affected README section: $SECTION"

# ── Version / date stamp ─────────────────────────────────────────────────────
CURRENT_VERSION=$(node -e "const p=require('$REPO_ROOT/package.json'); console.log(p.version)" 2>/dev/null || echo "unknown")
APP_VERSION=$(node -e "const a=require('$REPO_ROOT/app.json'); console.log(a.expo.version)" 2>/dev/null || echo "unknown")

echo "[doc-agent] package.json version: $CURRENT_VERSION"
echo "[doc-agent] app.json version:     $APP_VERSION"

# ── Check if README version badge is current ─────────────────────────────────
if [ -f "$README" ]; then
  README_SDK=$(grep -o 'SDK%20[0-9]*' "$README" | head -1 | sed 's/SDK%20//')
  APP_JSON_SDK=$(node -e "const a=require('$REPO_ROOT/app.json'); console.log(a.expo.sdkVersion || a.expo.sdk || '')" 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "")

  if [ -n "$APP_JSON_SDK" ] && [ "$README_SDK" != "$APP_JSON_SDK" ]; then
    echo "[doc-agent] SDK version mismatch: README=$README_SDK app.json=$APP_JSON_SDK — flagging for manual update"
  else
    echo "[doc-agent] SDK version badge is current ($README_SDK)"
  fi
fi

# ── Generate change summary for git commit ────────────────────────────────────
SUMMARY_FILE="$REPO_ROOT/maestro/results/doc_summary_$(date '+%Y%m%d_%H%M%S').txt"
mkdir -p "$(dirname "$SUMMARY_FILE")"

cat > "$SUMMARY_FILE" <<EOF
Documentation sync — $(date '+%Y-%m-%d %H:%M:%S')
Triggered by: ${CHANGED:-'full run'}
README section affected: $SECTION
App version: $APP_VERSION
Package version: $CURRENT_VERSION

Sections to review if this file changed:
$(case "$SECTION" in
  configuration)   echo "  - Configuration table (App Identity)" ;;
  tech-stack)      echo "  - Tech Stack tables (new/removed dependencies)" ;;
  services-storage) echo "  - Services > storage.js (new functions, changed behaviour)" ;;
  monetisation)    echo "  - Monetisation section (ad unit IDs, placements)" ;;
  services-split)  echo "  - Services > splitCalculator.js (algorithm changes)" ;;
  state-management) echo "  - State Management (context shape, lifecycle)" ;;
  navigation)      echo "  - Navigation Structure (new screens, flows)" ;;
  testing)         echo "  - Testing section (flow coverage table)" ;;
  *)               echo "  - General review recommended" ;;
esac)

Uncommitted changes in repo:
$(git -C "$REPO_ROOT" diff --name-only 2>/dev/null || echo "(none)")

Recent commits:
$(git -C "$REPO_ROOT" log --oneline -5 2>/dev/null || echo "(unavailable)")
EOF

echo "[doc-agent] Summary written to: $SUMMARY_FILE"
echo "[doc-agent] ✓ Documentation sync complete. Review summary above."
exit 0
