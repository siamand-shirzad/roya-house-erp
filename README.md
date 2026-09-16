# Roya House ERP

Persian RTL sales and warehouse workspace for Roya House, built with React, Vite, shadcn/ui, Express, TypeScript, and PostgreSQL (`pg`). Prisma is not used at runtime.

## Local development

Requires Node.js 20+ and PostgreSQL. Install the dependencies already declared in each package; UI components are checked in and do not need regenerating.

```powershell
npm --prefix backend ci
npm --prefix frontend ci
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Edit `backend/.env` with the database connection and `frontend/.env` with the API URL if necessary. Use `docker compose up -d` for the optional local database. Start each server in a separate terminal:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

The backend defaults to port 4000 and the frontend to 5173. The backend applies its idempotent schema SQL on startup. Visit `/login` to create the first admin on an empty database. `npm --prefix backend run db:setup` optionally loads the company catalog and sample documents; do not run it against an unintended database.

## Workflows

- Dashboard: sales overview, low-stock counts, and role-specific work awaiting action.
- Documents: proforma, invoice, and goods issue; draft/issued/cancelled lifecycle and linked conversion. Filters and pagination survive detail navigation.
- Document editor: protected unsaved changes, sticky totals/actions, accessible mobile item cards, row undo, and entry/preview views. Issue confirmation explains the lock and inventory effect.
- PDF: full-width Persian DOM capture, complete rows across A4 pages, repeated headers, and final-page totals/signatures.
- Customers: searchable address book and customer history with linked documents. Sales totals are not presented as outstanding balances.
- Products: keyboard price grid, draft changes, bulk adjustment and CSV import/export. Stale price saves are rejected.
- Inventory: receipts, adjustments, thresholds, and movement history; older movements can be fetched without the former fixed 2,000-row ceiling.
- Admins manage per-user module permissions (hidden, view, edit) and reset passwords. Existing passwords are hashed and cannot be viewed. Overrides are checked by the API as well as navigation.

Amounts are stored/edited in Toman and printed in Rial. Input accepts Persian digits; displayed digits follow the shared formatter. Short stock warns but does not block issuance. Buyer details are copied to documents.

## Verification

```powershell
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

Browser tests use Playwright with installed Microsoft Edge, a temporary Vite server on 5174, and intercepted test API fixtures. No production API is contacted. On Windows, the test process needs permission to launch and terminate its browser/server children. Use `npx playwright install chromium` and remove `channel: "msedge"` in the configuration if Edge is unavailable.

The backend integration suite uses a separate local PostgreSQL database and a unique temporary schema. It refuses remote hosts or a database name other than `roya_uiux_test`:

```powershell
docker run --rm -d --name roya-uiux-test -p 127.0.0.1:55432:5432 -e POSTGRES_PASSWORD=roya-test-only -e POSTGRES_DB=roya_uiux_test postgres:16-alpine
npm --prefix backend run test:integration
docker stop roya-uiux-test
```

The password above is only for this disposable local test container. Tests cover concurrent lifecycle changes, stock booking/reversal, stale writes, permissions, and list filtering. Test data is isolated and its schema is removed afterward.

## API and schema notes

The schema source is `backend/src/lib/db.ts`, including incremental `ALTER ... IF NOT EXISTS` statements. There is not yet a versioned migration runner. Review every schema change before deploying to an existing database.

`GET /api/documents/page` accepts `type`, `customerId`, `status`, `q`, `from`, `to`, `page`, and `pageSize` (maximum 100). It returns `{ rows, total, page, pageSize }`. Date filtering uses Tehran calendar days; date input values are ISO Gregorian dates, selected through the Persian calendar in document and report filters. The original document-list endpoint remains compatible for dashboard, search, and history consumers.

`GET /api/inventory/movements` accepts `productId`, `from`, `to`, `limit` (maximum 2000), and `offset`. The UI fetches batches of 200 and explicitly identifies search as covering loaded movements.

Document saves and bulk price saves send `expectedUpdatedAt`. A stale request receives 409. Conversion and cancellation serialize on the source document, preventing duplicate active conversions through these API routes.

## Deployment and next work

See [DEPLOY.md](DEPLOY.md) for the existing Liara deployment flow. The root build compiles both packages and Express serves the SPA with its API on one origin.

See [UI-UX-IMPROVEMENT-PLAN.md](UI-UX-IMPROVEMENT-PLAN.md) for the roadmap and [IMPLEMENTATION-NOTES.md](IMPLEMENTATION-NOTES.md) for delivered changes, verification, and remaining scope. Payments, partial deliveries/returns, supplier purchasing, and durable audit history require their business rules before implementation.


## Latest interface updates

- Product column visibility is configurable and remembered per user/browser; product codes start hidden. The brand selector covers Bana, Gboard, Roya and other products. Brand can be edited in the product dialog and round-trips through CSV. Legacy names/codes identify known brands; unrecognized products stay under Other until assigned.
- Inventory rows use category icons and drag handles instead of product codes. Mouse, touch, keyboard and row-menu up/down actions reorder the list. This is a personal browser preference, not a shared stock operation.
- An issued proforma can start a linked editable draft via `POST /api/documents/:id/revise`. Original items, buyer information and notes remain unchanged. Repeated requests reopen an existing revision draft. The revision gets a new number, must be issued separately, and links back to the prior version; invoices and goods issues retain their existing lifecycle.
- The English command palette separates Create and Navigation actions; sidebar labels are Persian, with a corrected icon rail. Mobile lists use cards and larger touch controls.
- User overrides cover dashboard, proforma, invoice, goods_issue, products, customers, inventory, reports and company. Admin accounts always retain full access; change to another role to restrict an account. Catalog/customer view access is needed for their document pickers. Seller metadata remains available inside permitted document workflows, while company settings require their own permission. Permission changes apply to API requests immediately and refresh in the UI when the user refocuses the tab.
- Additive startup schema updates add `users.permissions`, `products.brand` and `documents.revision_of_id`. No reseeding is needed.
