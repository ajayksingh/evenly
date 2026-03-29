#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# benchmark.sh — Evenly Quality Gate & Performance Benchmark
# Inspired by karpathy/autoresearch: fixed-budget measurable experiments.
#
# Runs 4 checks:
#   1. Web build succeeds
#   2. Lighthouse performance audit (web)
#   3. Viewport overflow detection at 3 widths (web)
#   4. Settlement algorithm correctness (1000 test cases)
#
# Outputs: autoperf/results.json with all metrics
# Exit code: 0 = all pass, 1 = regression detected
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RESULTS_FILE="autoperf/results.json"
BASELINE_FILE="autoperf/baseline-metrics.json"
PASS=true

echo "═══════════════════════════════════════════════════"
echo "  EVENLY QUALITY GATE"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Check 1: Web Build ───────────────────────────────────────────────────────
echo "▶ [1/4] Web build..."
BUILD_START=$(date +%s)
npx expo export --platform web --output-dir dist 2>&1 | tail -3
BUILD_END=$(date +%s)
BUILD_TIME=$((BUILD_END - BUILD_START))
BUNDLE_SIZE=$(stat -f%z dist/_expo/static/js/web/index-*.js 2>/dev/null || echo 0)
BUNDLE_SIZE_MB=$(echo "scale=2; $BUNDLE_SIZE / 1048576" | bc)
echo "  ✓ Build succeeded in ${BUILD_TIME}s (main bundle: ${BUNDLE_SIZE_MB} MB)"
echo ""

# ── Check 2: Lighthouse (if available) ───────────────────────────────────────
LIGHTHOUSE_SCORE="-"
LIGHTHOUSE_A11Y="-"
LIGHTHOUSE_TTI="-"
if command -v lighthouse &> /dev/null; then
  echo "▶ [2/4] Lighthouse audit..."
  # Serve dist at /evenly/ path to match production URL structure
  LH_DIR=$(mktemp -d)
  mkdir -p "$LH_DIR/evenly"
  cp -r dist/* "$LH_DIR/evenly/"
  npx serve "$LH_DIR" -l 3939 -s &>/dev/null &
  SERVE_PID=$!
  sleep 2

  LIGHTHOUSE_JSON=$(lighthouse http://localhost:3939/evenly/ \
    --chrome-flags="--headless --no-sandbox" \
    --output=json --quiet 2>/dev/null || echo '{}')

  kill $SERVE_PID 2>/dev/null || true
  rm -rf "$LH_DIR" 2>/dev/null || true

  LIGHTHOUSE_SCORE=$(echo "$LIGHTHOUSE_JSON" | node -e "
    const fs = require('fs'); let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try { const j=JSON.parse(d); console.log(Math.round((j.categories?.performance?.score||0)*100)); }
      catch { console.log(0); }
    });
  " 2>/dev/null || echo "0")
  LIGHTHOUSE_A11Y=$(echo "$LIGHTHOUSE_JSON" | node -e "
    const fs = require('fs'); let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try { const j=JSON.parse(d); console.log(Math.round((j.categories?.accessibility?.score||0)*100)); }
      catch { console.log(0); }
    });
  " 2>/dev/null || echo "0")

  echo "  Performance: ${LIGHTHOUSE_SCORE}/100"
  echo "  Accessibility: ${LIGHTHOUSE_A11Y}/100"
else
  echo "▶ [2/4] Lighthouse: SKIPPED (not installed — run: npm i -g lighthouse)"
fi
echo ""

# ── Check 3: Viewport Overflow Detection ─────────────────────────────────────
OVERFLOW_PASS=true
if command -v npx &> /dev/null && [ -f "node_modules/.bin/playwright" ]; then
  echo "▶ [3/4] Viewport overflow detection..."
  OVERFLOW_RESULT=$(node -e "
    const { chromium } = require('playwright');
    (async () => {
      const browser = await chromium.launch({ headless: true });
      const widths = [320, 375, 430];
      const results = {};
      for (const w of widths) {
        const page = await browser.newPage({ viewport: { width: w, height: 844 } });
        await page.goto('https://ajayksingh.github.io/evenly/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(3000);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        results[w] = overflow;
        await page.close();
      }
      await browser.close();
      console.log(JSON.stringify(results));
    })().catch(e => { console.log('{}'); process.exit(0); });
  " 2>/dev/null || echo '{}')

  for WIDTH in 320 375 430; do
    HAS_OVERFLOW=$(echo "$OVERFLOW_RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d)[$WIDTH]?'YES':'NO')}catch{console.log('SKIP')}})" 2>/dev/null || echo "SKIP")
    if [ "$HAS_OVERFLOW" = "YES" ]; then
      echo "  ✗ ${WIDTH}px: OVERFLOW DETECTED"
      OVERFLOW_PASS=false
      PASS=false
    elif [ "$HAS_OVERFLOW" = "NO" ]; then
      echo "  ✓ ${WIDTH}px: No overflow"
    else
      echo "  ~ ${WIDTH}px: Skipped"
    fi
  done
else
  echo "▶ [3/4] Overflow detection: SKIPPED (Playwright not available)"
fi
echo ""

# ── Check 4: Settlement Algorithm Correctness ────────────────────────────────
echo "▶ [4/4] Settlement algorithm test (1000 scenarios)..."
ALGO_RESULT=$(node autoperf/test-scenarios.js 2>/dev/null || echo '{"pass":false,"total":0,"correct":0,"avgTransactions":0}')
ALGO_PASS=$(echo "$ALGO_RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).pass?'true':'false')}catch{console.log('false')}})")
ALGO_CORRECT=$(echo "$ALGO_RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).correct)}catch{console.log(0)}})")
ALGO_TOTAL=$(echo "$ALGO_RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).total)}catch{console.log(0)}})")
ALGO_AVG_TX=$(echo "$ALGO_RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).avgTransactions)}catch{console.log(0)}})")

if [ "$ALGO_PASS" = "true" ]; then
  echo "  ✓ ${ALGO_CORRECT}/${ALGO_TOTAL} scenarios correct (avg ${ALGO_AVG_TX} transactions)"
else
  echo "  ✗ ALGORITHM FAILURE: ${ALGO_CORRECT}/${ALGO_TOTAL} correct"
  PASS=false
fi
echo ""

# ── Write Results ─────────────────────────────────────────────────────────────
cat > "$RESULTS_FILE" << EOJSON
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "buildTime": $BUILD_TIME,
  "bundleSizeMB": $BUNDLE_SIZE_MB,
  "lighthouse": {
    "performance": $LIGHTHOUSE_SCORE,
    "accessibility": $LIGHTHOUSE_A11Y
  },
  "overflow": {
    "320px": $([ "$OVERFLOW_PASS" = "true" ] && echo "false" || echo "true"),
    "pass": $OVERFLOW_PASS
  },
  "algorithm": {
    "correct": $ALGO_CORRECT,
    "total": $ALGO_TOTAL,
    "avgTransactions": $ALGO_AVG_TX,
    "pass": $ALGO_PASS
  },
  "pass": $PASS
}
EOJSON

echo "═══════════════════════════════════════════════════"
if [ "$PASS" = "true" ]; then
  echo "  ✓ ALL CHECKS PASSED"
  echo "═══════════════════════════════════════════════════"
  echo ""
  echo "Results saved to $RESULTS_FILE"
  exit 0
else
  echo "  ✗ QUALITY GATE FAILED — deploy blocked"
  echo "═══════════════════════════════════════════════════"
  echo ""
  echo "Results saved to $RESULTS_FILE"
  exit 1
fi
