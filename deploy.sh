#!/usr/bin/env bash
set -e

# Show what will be committed
git status

# Stage everything
git add -A

# Commit only if there are changes
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "${1:-Deploy update}"
fi

# Push to GitHub (triggers Railway if connected)
git push origin main