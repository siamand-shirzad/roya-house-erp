# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Roya House ERP is a sales and warehouse app for a drywall / suspended-ceiling supplier. There's an Express + PostgreSQL backend and a React + Vite + shadcn/ui frontend. The UI is **Persian (Farsi), RTL**. It produces three document types that copy the company's paper forms: Proforma (پیش فاکتور), Invoice (فاکتور), and Goods Issue (حواله خروج از انبار). Each one can be exported to PDF.

This is not a git repository, and there are no tests.

## Commands

Backend (`backend/`, runs on http://localhost:4000):
```bash
docker compose up -d        # from repo root: optional local Postgres 16 (postgres:postgres@localhost:5432/royahouse)
npm run prisma:seed         # creates tables (SCHEMA_SQL) + upserts the price list and sample docs; same as `npm run db:setup`
npm run dev                 # tsx watch src/index.ts
npm run build               # tsc -> dist/
```
Health check: `GET /api/health`. `backend/.env` needs `DATABASE_URL`, and optionally `PORT` and `CORS_ORIGIN` (comma-separated, default `http://localhost:5173`).

Frontend (`frontend/`, runs on http://localhost:5173):
```bash
npm run dev
npm run build               # tsc -b && vite build (this is the type check)
```
`VITE_API_URL` defaults to `http://localhost:4000/api`. There's a `lint` script, but the project has no ESLint config, so it won't run as-is.

On this Windows machine, Docker Desktop has to be running before `docker compose up -d`. `.claude/launch.json` defines `backend` and `frontend` preview configs.

Pinned versions: `@tanstack/react-table` must stay on **v8**, because `products-data-table.tsx` uses the v8 API (`useReactTable`, `getCoreRowModel`, ...) and v9 removed it. `vite.config.ts` sets an inline `css.postcss: {}` so Vite doesn't search parent folders for a PostCSS config (a stray empty `C:\Users\ASUS\package.json` broke that search). Tailwind v4 runs through `@tailwindcss/vite`.

## Docs don't match the code

- **The backend uses raw SQL over `pg`, not Prisma.** All data access goes through `backend/src/lib/db.ts` (`pool`, `query`, `queryOne`, `newId`). Prisma's engine binaries couldn't be downloaded in the original build environment, so Prisma was dropped.
- `backend/prisma/schema.prisma` is only kept as a readable model reference. The real schema is the `SCHEMA_SQL` string in `db.ts`, which uses snake_case tables and columns.
- Leftover scaffolding that nothing imports: `backend/src/prisma/` (a Prisma Next contract with sample User/Post models), `prisma.config.ts`, `prisma-next.md`, and `backend/README.md`. Don't use them as a guide to the real schema. `backend/tsconfig.json` excludes `src/prisma`, because its generated contract files don't exist.
- The root README and `frontend/setup.sh` mention `npm run prisma:migrate` and `prisma:studio`. Neither script exists. There are no migrations: `SCHEMA_SQL` only uses `CREATE TABLE IF NOT EXISTS`. That means changing a column on an existing table needs a manual `ALTER TABLE`, plus a matching update to `SCHEMA_SQL`.
- `frontend/src/components/ui/*` and the dashboard-01 components (`app-sidebar`, `site-header`, `section-cards`, `chart-area-interactive`) are already in the repo, but there's no `components.json`. Running `setup.sh` / `shadcn add` may overwrite them.

## Architecture

**Backend** (`backend/src/`): `index.ts` mounts three routers under `/api` (`products`, `customers`, `documents`). The central error handler turns a `ZodError` into a 400 response, so routes `parse()` with zod and pass errors to `next(err)`.
- Routes convert snake_case DB rows to camelCase JSON by hand (`rowToCompany`, `rowToItem`, and similar in `routes/documents.ts`). A new column has to be added in `SCHEMA_SQL`, in the INSERT/UPDATE statements, in the row mapper, and in the zod schema.
- IDs are prefixed text UUIDs from `newId("doc" | "item" | "prod" | ...)`.
- Document numbers are assigned per type as `max(number)+1`, starting from `STARTING_NUMBER` (so numbering continues from the real paper documents). `(type, number)` is unique.
- Creating or updating a document runs in a transaction. On update, the item list is replaced completely: all items are deleted and reinserted with `row_no` values.
- Deleting a product is a soft delete (`active = false`).
- Buyer details are **copied onto the document** (`buyer_*` columns) as well as the optional `customer_id`. Printed documents keep the buyer data from when they were created.

**Totals**: `computeLineTotals` / `computeDocumentTotals` exist twice, in `backend/src/lib/totals.ts` (server, authoritative, recomputed on every load and save) and `frontend/src/lib/totals.ts` (live preview). **Keep them identical.** The formula per line: `lineTotal = round(qty*unitPrice)`, subtract `discount` (an absolute amount), then add `round(afterDiscount*taxRate/100)`.

**Money**: prices are stored as integers in **Toman**. The printed documents show **Rial**, which is Toman × 10 (`formatRial` in `frontend/src/lib/format.ts`). Quantities are `numeric(12,2)`, and `pg` returns them as strings, so they're wrapped in `Number()`.

**Theming / layout**: every page renders inside `AppShell` (`components/app-shell.tsx`), which provides the right-side inset sidebar and a sticky `SiteHeader` (title, per-page actions, theme toggle). Dark mode is the `.dark` class on `<html>`, managed by `ThemeProvider` (`light`/`dark`/`system`, saved in localStorage key `roya-theme`). An inline script in `index.html` applies it before first paint, so keep the key in sync in both places. Use theme tokens (`bg-card`, `text-muted-foreground`, `bg-primary/10`, ...) rather than fixed colors, **except in `DocumentPrint`**: it is paper and deliberately stays white with fixed `neutral-*` colors in both themes. The brand accent is the warm bronze `--primary` in `index.css`.

**Frontend** (`frontend/src/`): react-router routes are `/` (dashboard + `products-data-table.tsx` reading `/api/products`) and `/documents/:typeSlug[/new|/:id]`. The URL slugs (`proforma`, `invoice`, `goods-issue`) map to the API enum (`PROFORMA`, `INVOICE`, `GOODS_ISSUE`) in `lib/documentTypeSlug.ts`. One list page and one form page serve all three types. `App.tsx` keys the form by `typeSlug/id`, so state never carries over between documents. `DocumentFormPage` has an editor (`ItemsEditor`, `ProductPicker`, `PartyForm`) next to a live `DocumentPrint` preview. The type decides which columns and fields appear: invoices have discount and tax columns, goods-issue has vehicle and delivery fields. All HTTP calls go through `lib/api.ts`. Shared types live in `types.ts`. `@/` resolves to `src/`.

**PDF export**: `ExportPdfButton` uses **html2canvas-pro** to capture the mounted `DocumentPrint` DOM node by element id, then tiles the image across A4 pages with jsPDF. Capturing the rendered DOM is what keeps Persian text shaping and RTL layout correct. Don't switch to drawing text with jsPDF directly. Don't go back to plain `html2canvas`: it throws on Tailwind v4's `oklch()` colors. The `DocumentPrint` sheet must keep its fixed `w-[794px]` (no `max-w-full`), or the PDF layout shrinks with the screen width. On screen, `PrintPreview` shrinks it to fit with CSS `zoom` (so the preview never scrolls). `ExportPdfButton`'s `onclone` resets that zoom (`[data-print-zoom]`) so the PDF is always captured at full size.

**Persian formatting**: `lib/format.ts` has the Persian-digit conversion, Toman/Rial formatting, and a built-in Gregorian→Jalali date converter (no date library). `lib/numberToWords.ts` writes amounts out in Persian words for the printed totals. RTL overrides are in `rtl.css`.

The seed (`backend/prisma/seed.ts`) contains the company's full price list (in Toman) and three sample documents. It's idempotent: products are upserted by `code`, and the company row uses the fixed id `royahouse-main`. New documents link to the first company row.
