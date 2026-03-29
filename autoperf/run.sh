#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# run.sh — Evenly Nightly Auto-Optimizer
# Inspired by karpathy/autoresearch: autonomous iterative improvement.
#
# This script is designed to be run by a Claude Code agent (or manually).
# Each cycle:
#   1. Reads goals.md for optimization priorities
#   2. Runs benchmark.sh to get current metrics
#   3. Stores baseline metrics
#   4. The calling agent makes one optimization
#   5. Runs benchmark.sh again
#   6. If improved: commit with [autoperf] prefix
#   7. If regressed: revert
#   8. Repeat
#
# Usage:
#   Manual:      bash autoperf/run.sh
#   With agent:  "Read autoperf/goals.md and autoperf/run.sh, then run an optimization cycle"
#   Scheduled:   /schedule with cron
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RESULTS_FILE="autoperf/results.json"
BASELINE_FILE="autoperf/baseline-metrics.json"

echo "═══════════════════════════════════════════════════"
echo "  EVENLY AUTO-OPTIMIZER — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Step 1: Run baseline benchmark ───────────────────────────────────────────
echo "▶ Running baseline benchmark..."
bash autoperf/benchmark.sh || true
cp "$RESULTS_FILE" "$BASELINE_FILE" 2>/dev/null || true

echo ""
echo "▶ Baseline captured. Ready for optimization."
echo ""
echo "═══════════════════════════════════════════════════"
echo "  AGENT INSTRUCTIONS"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  1. Read autoperf/goals.md for priorities"
echo "  2. Read autoperf/baseline-metrics.json for current metrics"
echo "  3. Make ONE targeted optimization to the app code"
echo "  4. Run: bash autoperf/benchmark.sh"
echo "  5. Compare autoperf/results.json vs baseline-metrics.json"
echo "  6. If improved: git commit with [autoperf] prefix"
echo "  7. If regressed: git checkout -- . (revert all changes)"
echo "  8. Repeat from step 3"
echo ""
echo "  Time budget per cycle: ~5 minutes"
echo "  Target: 12 cycles per hour"
echo ""
echo "═══════════════════════════════════════════════════"
