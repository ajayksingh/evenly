#!/usr/bin/env node
/**
 * Post-build patch: fix asset paths for GitHub Pages subdirectory deployment.
 *
 * Metro bundler hardcodes "/assets/..." absolute paths in the bundle.
 * On GitHub Pages the app lives at /evenly/, so assets must be at /evenly/assets/...
 * This script patches all JS bundles in dist/ after `expo export`.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '..', 'dist');
const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');

// 1. Patch JS bundles: fix asset paths
if (fs.existsSync(jsDir)) {
  const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  let totalPatched = 0;
  for (const file of files) {
    const filePath = path.join(jsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const before = (content.match(/\"\/assets\//g) || []).length;
    content = content.replace(/\"\/assets\//g, '"/evenly/assets/');
    if (before > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  Patched ${file}: ${before} asset path(s) fixed`);
      totalPatched += before;
    }
  }
  console.log(`Asset path patch complete: ${totalPatched} total replacements across ${files.length} bundle(s).`);
} else {
  console.warn('Warning: dist/_expo/static/js/web not found — skipping asset patch.');
}

// 2. Ensure .nojekyll exists (GitHub Pages needs this to serve _expo/ directory)
const nojekyll = path.join(distDir, '.nojekyll');
if (!fs.existsSync(nojekyll)) {
  fs.writeFileSync(nojekyll, '');
  console.log('Created dist/.nojekyll');
}

// 3. Patch index.html: ensure script src uses relative path (no leading slash)
//    + inject iOS Safari scroll fix
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  let html = fs.readFileSync(indexHtml, 'utf8');
  // Replace absolute script src with relative
  html = html.replace(/src="\/_expo\//g, 'src="_expo/');
  // Inject iOS Safari scroll fix
  const iosFix = `<style>
    /* iOS Safari scroll fix */
    html { height: 100%; }
    body { height: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
    #root { height: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
  </style>`;
  if (!html.includes('iOS Safari scroll fix')) {
    html = html.replace('</head>', iosFix + '\n</head>');
    console.log('Patched index.html: injected iOS Safari scroll fix');
  }
  fs.writeFileSync(indexHtml, html, 'utf8');
  console.log('Patched index.html: made script src relative');
}

console.log('Post-build patch done.');
