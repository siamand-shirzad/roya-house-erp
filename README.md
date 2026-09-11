# رویا هاوس — سامانه فروش و انبار (Roya House ERP)

A full-stack app for Roya House (drywall / suspended-ceiling systems):
- A shadcn/ui **dashboard** (built from the official `dashboard-01` block) whose data table
  is wired to the real Roya House price list instead of mock data.
- Three Persian, RTL document templates that reproduce the paper forms you use today:
  **پیش فاکتور** (Proforma Invoice), **فاکتور / صورتحساب فروش** (Invoice), and
  **حواله خروج از انبار کالا** (Goods Issue) — each with one-click **PDF export**.

## Stack

- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Frontend**: React + Vite + TypeScript + Tailwind + shadcn/ui + react-router
- **PDF export**: html2canvas + jsPDF (captures the live, styled document so Persian/RTL text renders correctly)

## Why setup isn't just "npm install" here

This project was built in a sandboxed environment without access to the public npm registry,
so the shadcn/ui primitives (button, table, sidebar, etc.) and the `dashboard-01` block itself
could not be fetched and test-run here. Everything specific to Roya House — the Prisma schema,
the Express API, the product catalog seeded from your price list, the three document templates,
and the PDF export — is hand-written and complete. The **only** thing left for your machine to do
is run the official `shadcn` CLI once, so you get its exact, current-version files rather than a
hand-transcribed copy. This takes about two minutes. See "Known follow-ups" below.

## 1. Backend setup

```bash
cd backend
cp .env.example .env      # edit DATABASE_URL if needed
npm install

# Option A: you already have PostgreSQL running locally
#   just make sure .env's DATABASE_URL points at it.
# Option B: use the provided docker-compose (from the repo root)
cd .. && docker compose up -d && cd backend

npm run prisma:migrate    # creates the schema (prompts for a migration name, e.g. "init")
npm run prisma:seed       # loads the full Roya House price list + sample documents
npm run dev                # http://localhost:4000
```

Health check: `curl http://localhost:4000/api/health`

### API summary

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/products` | List products (`?q=`, `?category=`) |
| POST/PUT/DELETE | `/api/products/:id` | Manage catalog (DELETE soft-deletes) |
| GET/POST | `/api/customers` | Manage buyers |
| GET | `/api/documents?type=PROFORMA\|INVOICE\|GOODS_ISSUE` | List documents |
| GET/POST/PUT/DELETE | `/api/documents/:id` | Create/edit a document; totals are always recomputed server-side |

## 2. Frontend setup

```bash
cd frontend
bash setup.sh
```

`setup.sh` runs, in order:
1. `npm install` — React, react-router, `@tanstack/react-table`, html2canvas, jsPDF (already declared in `package.json`).
2. `npx shadcn@latest init` — sets up Tailwind + `components.json`. **When prompted, choose:** Style = New York, Base color = Neutral, CSS variables = Yes.
3. `npx shadcn@latest add dashboard-01` — generates the official sidebar/header/chart/table shell into `src/components/`.
4. `npx shadcn@latest add button card table badge input select textarea dialog dropdown-menu label separator command popover sonner` — every primitive the document pages use.

Then:

```bash
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:4000/api
npm run dev             # http://localhost:5173
```

## What you get

- **`/`** — the dashboard: KPI cards + chart from the stock `dashboard-01` block, and below them
  `ProductsDataTable` (`src/components/products-data-table.tsx`) — a sortable, searchable,
  category-filterable table reading live from `/api/products`, seeded with the **entire**
  لیست قیمت رویاهاوس (پنل‌های گچی، سازه، تایل، سپری، پیچ و بولت، نوار و بتونه، اتصالات، سایر
  محصولات، و جدول مقایسه‌ای پنل‌های برند — ۶۶ قلم کالا).
- **`/documents/proforma`**, **`/documents/invoice`**, **`/documents/goods-issue`** — list +
  "سند جدید" to open the editor. Each editor has a live preview styled to match your paper
  templates (seller/buyer boxes, RTL items table with مبلغ/تخفیف/مالیات columns for invoices,
  the delivery statement + vehicle fields for goods-issue) and a **دانلود PDF** button.
- Document numbering continues from your real samples (Proforma starts at ۱۱۸۴۳, Invoice at
  ۲۰۴۰, Goods Issue at ۲۰۴۱) since the seed data includes the three original documents you sent
  (شماره ۱۱۸۴۲ / ۲۰۳۹ / ۲۰۳۹) for خانم رویا جلالی as worked examples.

## Known follow-ups (do these once, on your machine)

1. **Run `frontend/setup.sh`** as above — this is the one CLI step this environment couldn't
   run for you.
2. `DashboardPage.tsx` imports `AppSidebar`, `SiteHeader`, `SectionCards`, and
   `ChartAreaInteractive` from the paths the current `dashboard-01` block generates
   (`@/components/app-sidebar`, `@/components/site-header`, etc.). If the CLI names anything
   slightly differently by the time you run it, just fix those four import lines — everything
   else (the product table, the three document templates, the whole backend) doesn't depend on
   dashboard-01's internals at all.
3. The sidebar's own nav links (from `app-sidebar.tsx`) are the block's generic placeholders.
   Feel free to point them at `/documents/proforma`, `/documents/invoice`, `/documents/goods-issue` —
   or just use the small nav bar already at the top of every document page.
4. Company legal fields (`nationalId`, `economicCode`, `registration`) were left blank in the
   seed since they weren't on the source documents — fill them in via Prisma Studio
   (`npm run prisma:studio` in `backend/`) or a quick `PUT` once you have them.

## Project layout

```
roya-house-erp/
  backend/
    prisma/schema.prisma   # Company, Customer, Product, Document, DocumentItem
    prisma/seed.ts         # full price list + sample seller/buyer/documents
    src/routes/            # products, customers, documents
    src/lib/totals.ts      # server-side totals (always authoritative)
  frontend/
    setup.sh               # shadcn scaffolding, run once
    src/pages/DashboardPage.tsx
    src/components/products-data-table.tsx
    src/components/documents/           # DocumentPrint, ItemsEditor, ProductPicker, ExportPdfButton
    src/pages/documents/                # list + editor pages, one route per document type
    src/lib/                            # api client, Jalali dates, Persian digits/number-to-words
  docker-compose.yml        # optional local PostgreSQL
```
