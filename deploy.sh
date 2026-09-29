set -euo pipefail

echo "==> Pull latest changes"
git pull --ff-only

echo "==> Install dependencies"
npm ci

echo "==> Build backend"
npm run backend:build

echo "==> Build frontend"
npm run frontend:build

echo "==> Restart applications"
pm2 restart mimi-backend mimi-frontend --update-env

echo "==> Deployment finished"
pm2 status