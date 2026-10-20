#!/bin/bash
# Rebuild and publish Mega Hub to GitHub Pages (gh-pages branch)
set -e
cd "$(dirname "$0")"
# Production backend: hosted Supabase (London). Only the PUBLIC anon key belongs here (it ships in the bundle anyway);
# the service_role key must never be in this repo or the build.
export EXPO_PUBLIC_BACKEND=supabase
export EXPO_PUBLIC_SUPABASE_URL=https://guudlszblkjdioyekxjb.supabase.co
export EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dWRsc3pibGtqZGlveWVreGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MjUzNDAsImV4cCI6MjEwODEwMTM0MH0.r6gpTKzjQhN5frh1hi5CYRN4gBISNLn_JQd9EtpJWP8
node -e 'const r=JSON.parse(Buffer.from(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.split(".")[1],"base64url")).role; if(r!=="anon"){console.error("refusing to build: key role is "+r+", not anon");process.exit(1)}'
rm -rf dist && npm run export:web
cp dist/index.html dist/404.html && touch dist/.nojekyll
cd dist && rm -rf .git && git init -q -b gh-pages && git add -A && git commit -qm "Deploy $(date -u +%FT%TZ)"
git push -f "https://github.com/vinilifeos-glitch/mega-hub.git" gh-pages
rm -rf .git
