#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# orchestrate.sh
# Super-agent orchestrator. Runs the test pipeline and documentation update
# in parallel. Waits for both to complete, then reports combined results.
#
# Usage:
#   bash scripts/orchestrate.sh                  # full pipeline
#   bash scripts/orchestrate.sh --tests-only     # skip doc update
#   bash scripts/orchestrate.sh --docs-only      # skip tests
#   bash scripts/orchestrate.sh --changed <file> # only run what's relevant
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS_DIR="$REPO_ROOT/maestro/results"
LOG_DIR="$REPO_ROOT/maestro/results/logs"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

mkdir -p "$LOG_DIR"

RUN_TESTS=true
RUN_DOCS=true
RUN_GEN_TESTS=true
CHANGED_FILE=""

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --tests-only)  RUN_DOCS=false;  RUN_GEN_TESTS=false; shift ;;
    --docs-only)   RUN_TESTS=false; RUN_GEN_TESTS=false; shift ;;
    --changed)     CHANGED_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ── Helper: print section header ──────────────────────────────────────────────
header() { echo ""; echo "┌── $1"; echo "│"; }
footer() { echo "│"; echo "└── $1"; echo ""; }

# ── Determine which tests are relevant ───────────────────────────────────────
relevant_flows() {
  local changed="$1"
  # Always run the full core suite — expense + settlement pipeline is foundational
  echo "core"
}

# ─────────────────────────────────────────────────────────────────────────────
header "SUPER-AGENT ORCHESTRATOR — $TIMESTAMP"
echo "│  Repo:    $REPO_ROOT"
echo "│  Changed: ${CHANGED_FILE:-'(full run)'}"
echo "│  Jobs:    tests=$RUN_TESTS  docs=$RUN_DOCS  gen-tests=$RUN_GEN_TESTS"

# ── Launch agents in parallel ─────────────────────────────────────────────────
TEST_LOG="$LOG_DIR/tests_${TIMESTAMP}.log"
DOC_LOG="$LOG_DIR/docs_${TIMESTAMP}.log"
GEN_LOG="$LOG_DIR/gen_${TIMESTAMP}.log"

TEST_PID=""
DOC_PID=""
GEN_PID=""
TEST_EXIT=0
DOC_EXIT=0
GEN_EXIT=0

if [ "$RUN_TESTS" = true ]; then
  echo "│  [test-agent]   starting..."
  bash "$REPO_ROOT/scripts/run-tests.sh" > "$TEST_LOG" 2>&1 &
  TEST_PID=$!
fi

if [ "$RUN_DOCS" = true ]; then
  echo "│  [doc-agent]    starting..."
  bash "$REPO_ROOT/scripts/update-docs.sh" "${CHANGED_FILE}" > "$DOC_LOG" 2>&1 &
  DOC_PID=$!
fi

if [ "$RUN_GEN_TESTS" = true ] && [ -n "$CHANGED_FILE" ]; then
  echo "│  [gen-agent]    starting..."
  bash "$REPO_ROOT/scripts/generate-tests.sh" "${CHANGED_FILE}" > "$GEN_LOG" 2>&1 &
  GEN_PID=$!
fi

# ── Wait for all agents ───────────────────────────────────────────────────────
echo "│"
echo "│  Waiting for agents to complete..."

if [ -n "$TEST_PID" ]; then
  wait "$TEST_PID" && TEST_EXIT=0 || TEST_EXIT=$?
  if [ $TEST_EXIT -eq 0 ]; then
    echo "│  [test-agent]   ✓ PASSED"
  else
    echo "│  [test-agent]   ✗ FAILED (see $TEST_LOG)"
  fi
fi

if [ -n "$DOC_PID" ]; then
  wait "$DOC_PID" && DOC_EXIT=0 || DOC_EXIT=$?
  if [ $DOC_EXIT -eq 0 ]; then
    echo "│  [doc-agent]    ✓ DONE"
  else
    echo "│  [doc-agent]    ⚠ WARNING (see $DOC_LOG)"
  fi
fi

if [ -n "$GEN_PID" ]; then
  wait "$GEN_PID" && GEN_EXIT=0 || GEN_EXIT=$?
  if [ $GEN_EXIT -eq 0 ]; then
    echo "│  [gen-agent]    ✓ DONE"
  else
    echo "│  [gen-agent]    ⚠ WARNING (see $GEN_LOG)"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo "│"
OVERALL_EXIT=0
if [ $TEST_EXIT -ne 0 ]; then
  OVERALL_EXIT=1
  footer "PIPELINE FAILED — tests did not pass. Changes blocked from going live."
  echo ""
  echo "Test output:"
  cat "$TEST_LOG"
  exit 1
fi

footer "PIPELINE PASSED — app is stable. Safe to deploy."
exit 0
