#!/usr/bin/env bash
# One-shot setup for the Roya House frontend: installs base deps, then runs
# the official shadcn CLI to scaffold Tailwind + the dashboard-01 block +
# every shadcn/ui primitive this project's custom pages use. Run from
# inside the frontend/ folder:
#
#   bash setup.sh
#
set -euo pipefail

echo "==> Installing base dependencies (React, Vite, router, PDF export libs)..."
npm install

echo "==> Running shadcn init (Tailwind + components.json + path alias)..."
echo "    When prompted: Style = New York, Base color = Neutral, CSS variables = Yes."
npx shadcn@latest init

echo "==> Adding the dashboard-01 block (sidebar + header + charts + table shell)..."
npx shadcn@latest add dashboard-01

echo "==> Adding the remaining shadcn/ui primitives used by the document pages..."
npx shadcn@latest add button card table badge input select textarea dialog dropdown-menu \
  label separator command popover sonner

echo "==> Done. Copy backend/.env.example -> backend/.env, then:"
echo "      cd ../backend && npm install && npm run prisma:migrate && npm run prisma:seed && npm run dev"
echo "    In another terminal:"
echo "      npm run dev   (from frontend/)"
