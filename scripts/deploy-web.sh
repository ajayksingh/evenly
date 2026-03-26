#!/bin/bash
set -e

GITHUB_REPO="https://github.com/ajayksingh/evenly.git"

echo "▶ Building web bundle..."
npx expo export --platform web --output-dir dist

echo "▶ Deploying to gh-pages..."
touch dist/.nojekyll
cd dist
git init
git add -A
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M')"
git push -f "$GITHUB_REPO" HEAD:gh-pages

echo "✓ Done — https://ajayksingh.github.io/evenly"
