#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-web.sh
# Builds the web bundle and deploys to GitHub Pages.
# Runs core E2E tests first if a device is available — blocks deploy on failure.
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GITHUB_REPO="https://github.com/ajayksingh/evenly.git"

# ── Test gate (skip if no device attached) ────────────────────────────────────
DEVICE=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1; exit}')

if [ -n "$DEVICE" ]; then
  echo "▶ Device detected ($DEVICE) — running test gate before deploy..."
  echo ""
  bash "$REPO_ROOT/scripts/run-tests.sh"
  echo ""
else
  echo "⚠ No device attached — skipping E2E gate. Deploy proceeds."
  echo "  Connect a device to enforce the test gate."
  echo ""
fi

# ── Autoperf Quality Gate (settlement algorithm) ─────────────────────────────
echo "▶ Running settlement algorithm test (1000 scenarios)..."
ALGO_RESULT=$(node "$REPO_ROOT/autoperf/test-scenarios.js" 2>/dev/null || echo '{"pass":false}')
ALGO_PASS=$(echo "$ALGO_RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).pass)}catch{console.log(false)}})")
if [ "$ALGO_PASS" = "true" ]; then
  echo "  ✓ Settlement algorithm: 1000/1000 pass"
else
  echo "  ✗ Settlement algorithm FAILED — deploy blocked"
  echo "  $ALGO_RESULT"
  exit 1
fi
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
echo "▶ Building web bundle..."
npx expo export --platform web --output-dir dist

# ── Deploy ────────────────────────────────────────────────────────────────────
echo "▶ Deploying to gh-pages..."
touch dist/.nojekyll
cd dist
git init
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -f "$GITHUB_REPO" HEAD:gh-pages

echo "✓ Done — https://ajayksingh.github.io/evenly"
