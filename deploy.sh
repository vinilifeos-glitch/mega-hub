#!/bin/bash
# Rebuild and publish Mega Hub to GitHub Pages (gh-pages branch)
set -e
cd "$(dirname "$0")"
rm -rf dist && npm run export:web
cp dist/index.html dist/404.html && touch dist/.nojekyll
cd dist && rm -rf .git && git init -q -b gh-pages && git add -A && git commit -qm "Deploy $(date -u +%FT%TZ)"
git push -f "https://github.com/vinilifeos-glitch/mega-hub.git" gh-pages
rm -rf .git
