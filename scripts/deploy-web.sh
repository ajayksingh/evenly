#!/bin/bash
set -e

# ─── CONFIG ────────────────────────────────────────────────────────────────────
ADSENSE_PUBLISHER_ID="ca-pub-9004418283363709"
GITHUB_REPO="https://github.com/ajayksingh/evenly.git"
# ───────────────────────────────────────────────────────────────────────────────

echo "▶ Building web bundle..."
npx expo export --platform web --output-dir dist

# Inject AdSense script into <head> only if publisher ID is set
if [[ "$ADSENSE_PUBLISHER_ID" != *"REPLACE"* ]]; then
  echo "▶ Injecting AdSense ($ADSENSE_PUBLISHER_ID)..."
  ADSENSE_SCRIPT="<script async src=\"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}\" crossorigin=\"anonymous\"></script>"
  sed -i '' "s|</head>|${ADSENSE_SCRIPT}</head>|" dist/index.html
else
  echo "⚠ AdSense publisher ID not set — skipping ad injection"
fi

echo "▶ Deploying to gh-pages..."
touch dist/.nojekyll
cd dist
git init
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -f "$GITHUB_REPO" HEAD:gh-pages

echo "✓ Done — https://ajayksingh.github.io/evenly"
