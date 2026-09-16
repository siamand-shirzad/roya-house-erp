# UI/UX implementation notes

Date: 2026-09-16. Changes are local and have not been deployed.

## Delivered

- Reviewed and retained the first-stage work already present at implementation start: data-router navigation guards, separate dashboard failure states, and document transaction locking.
- Fixed new-document Save and leave so it reaches the requested destination instead of remounting the newly saved document first. Buyer-only and notes-only edits are protected, including customer-prefill query changes.
- Failed document loads cannot expose an editable blank replacement. Failed dashboard stock requests have a visible retry action.
- New documents expand buyer details. Totals, save state, and actions stay visible. Entry/preview switching keeps small screens focused; wide screens keep both panes.
- Item entry has accessible field names, Persian-normalized product/customer search, focus on the new quantity, mobile cards, stable IDs, and undo for row removal. Compact dialogs can scroll when viewport height requires it.
- Added document notes and issuance review with buyer, row count, total, and lock/stock consequences. Reused the shared status badge.
- Added customer detail/history routes and role-specific dashboard follow-up tasks. Warehouse users can convert an issued invoice to a goods issue without sales-edit permission.
- Document lists use a validated, paginated API with Tehran-day date filtering and Persian-normalized search. URL state preserves filters/page when returning from detail. Customer search and pagination are also URL-backed.
- Inventory loads older movements in batches instead of silently stopping at 2,000. The interface explicitly states that local search covers loaded movements.
- Bulk price updates accept a stale-write token and roll back conflicting batches. Document lifecycle writes serialize transitions and conversion on the relevant row; integration tests exercise concurrent requests.
- PDF export builds whole-row A4 pages with repeated document/table headers and final-page totals/signatures. Customer balance is shown as unrecorded instead of a hard-coded zero. Oversized individual rows/notes produce an explicit error rather than silently clipping.
- Split heavy routes. Main JavaScript chunk decreased from about 1,067 kB to 403 kB minified (317 kB to 122 kB gzip); shared/lazy chunks remain separate, so this is not a claim about total network transfer. Production build no longer emits the large-chunk or Vite config-loader warnings observed initially.
- Replaced obsolete Prisma/setup instructions and added repeatable browser/database test commands.

## Verification

- Frontend and backend production builds pass.
- Playwright browser checks use Microsoft Edge and isolated API fixtures: unsaved buyer edits, save-and-leave, failed save preservation, dashboard failure/retry, Persian search/customer history, mobile entry/undo/overflow, failed document load, warehouse conversion access, persistent paginated filters, and actual multipage PDF generation.
- PostgreSQL integration tests use a dedicated disposable local database and random temporary schema: concurrent conversion, cancellation/conversion, edit/issue stock consistency, repeated issue/reversal, stale document and price saves, warehouse permissions, and paginated Persian search/validation.
- Inspected mobile-editor and desktop-dashboard screenshots. These fixtures do not substitute for operator acceptance with real business documents.
- Existing uncommitted user changes were preserved; no commit, deployment, production data mutation, or business messaging was performed.

## Remaining roadmap scope

This delivery covers the core reliability and daily workflow improvements, not every optional item in the original roadmap.

- Dashboard, command search, and customer history still use the compatible full document-list API. A dedicated aggregate summary/search API and bounded customer history should follow as the dataset grows.
- Durable draft recovery, price-conflict comparison UI, versioned schema migrations, a database uniqueness constraint for active conversions, and durable audit events remain follow-ups. Current API conversion concurrency is protected by source-row locking and tested.
- Inventory offset pagination can shift while other users post new movements; refresh reloads the first batch, and appended duplicates are suppressed. A stable cursor and server-side movement search/export are future work.
- PDF regression coverage includes a 40-line invoice and actual export. Broader goods-issue/proforma fixtures, very large print jobs, full contrast/focus auditing, and 200% zoom acceptance remain useful additions.
- Payment allocation, receivables, partial dispatch/returns, supplier purchasing, and partner-pricing policy remain separate domain features. The implementation did not invent their business rules. Customer history and dispatch visibility were the default priority while the optional preference question remained unanswered.

## Development notes

Run commands in the root README. Browser tests need permission to start/stop child processes on Windows; sandboxed runs completed checks but stalled at teardown, whereas the unrestricted approved run exited normally. Downloading bundled Chromium was unavailable from the provider in this location, so tests use installed Edge.

The backend test runner refuses production/remote database targets and removes only its randomly named test schema. The temporary Docker container is not required for normal app operation.


## Follow-up implementation: requested interface and access changes

Delivered configurable product columns (code hidden by default), editable/persisted brands with CSV support, a brand selector, personal inventory row ordering with mouse/touch/keyboard support, linked revisions for issued proformas, Persian date pickers, English Mac-style command actions, Persian sidebar labels and corrected collapsed sizing, per-user API-enforced module access, admin password reset/generation/reveal of the new password only, and mobile cards/touch controls.

Verification includes 20 browser scenarios (including desktop drag, keyboard reorder and persistence, mobile layouts at 360 px, Persian-to-ISO date selection, permissions, password form, quote revision and collapsed rail geometry) and 13 database integration scenarios (including revision concurrency/immutability, access revocation/grants, password hashing/session revocation, seller metadata access and brand persistence/import). Browser cases use fixtures; integration cases use the disposable test database. No real business documents were modified by verification.

The local backend was restarted to apply additive schema updates; frontend and API health endpoints responded. Personal order/column choices are per browser. Quote revisions use separate linked document numbers and do not replace previously issued invoices. This is local delivery, not a deployment.
