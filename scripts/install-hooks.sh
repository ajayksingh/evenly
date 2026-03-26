#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# install-hooks.sh
# Installs git hooks from scripts/hooks/ into .git/hooks/.
# Run once after cloning: bash scripts/install-hooks.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SOURCE="$REPO_ROOT/scripts/hooks"
HOOKS_DEST="$REPO_ROOT/.git/hooks"

for hook in "$HOOKS_SOURCE"/*; do
  hook_name=$(basename "$hook")
  dest="$HOOKS_DEST/$hook_name"

  cp "$hook" "$dest"
  chmod +x "$dest"
  echo "✓ Installed: .git/hooks/$hook_name"
done

echo ""
echo "✓ All hooks installed. Spec-file changes will trigger E2E tests before push."
