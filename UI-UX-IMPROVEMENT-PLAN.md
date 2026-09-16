# Roya House: UI, UX, and functionality improvement plan

Reviewed: 2026-09-16. Scope: current working tree, including existing local edits.

## Direction

Make the application a dependable daily workspace for sales and warehouse staff: find the next task, create a correct document quickly, and see what happened after issuance. Keep the existing Persian RTL interface, grey/red identity, shadcn components, keyboard price editing, and paper document layouts.

Improve the document workflow first. It connects customers, prices, stock, reports, and PDF output, so improvements here benefit the whole product.

## Review evidence and limits

- Inspected routing, dashboard, document list/editor and lifecycle API, customer and product selection, price editing, inventory, shared dialogs, PDF export, schema, and project instructions.
- Frontend production build and backend TypeScript build passed. The npm PowerShell wrapper printed a permission warning, but both builds completed successfully.
- Frontend emitted a large-chunk warning: the main JavaScript bundle is approximately 1,067 kB minified / 317 kB gzip. Vite also warned about future native config loading and `__dirname`.
- No project test files were found in the file scan. No automated test suite was run. The frontend declares a lint command without an accompanying ESLint configuration.
- This is a source-based assessment, not a completed visual/browser or database-backed QA pass. Responsive layout, contrast, focus behavior, and concurrency scenarios still require runtime verification. Backend races below are inferred from the inspected SQL and transaction boundaries.
- Existing uncommitted edits were preserved. Only this plan was added.

## Existing strengths to preserve

- Draft → issued → cancelled lifecycle; linked proforma → invoice → goods issue conversion.
- Server-side role checks, transaction-based saves, serialized document numbering, and issue/cancel stock movements.
- Buyer details copied into documents, server-calculated totals, Persian date formatting, and Toman-to-Rial print conversion.
- Command palette, normalized search utility, bulk price drafts, CSV preview, low-stock thresholds, and report follow-up lists.
- Shared shell, theme tokens, centralized business icons, responsive sidebar, and fixed-width RTL paper output.

## Priority 0: trust and work preservation

### 1. Protect every unsaved edit

**Evidence:** `DocumentFormPage.tsx` and `ProductsPage.tsx` register `beforeunload`, but no internal route blocker was found. A new document is considered dirty only when it has items, so buyer-only or notes-only changes are missed.

**Plan:** Add a shared dirty-form guard covering sidebar links, header back, browser back, and command-palette navigation. Compare the full new-document payload against its initial state. Provide Save / Discard / Stay; if an incomplete draft cannot be saved, explain why and retain the form. Show a persistent saved/unsaved indicator. Consider recoverable per-user drafts after navigation protection is reliable; clear recovery data on logout and successful completion.

**Acceptance:** Editing only buyer details triggers protection. Failed saves never navigate away. Both document and price edits survive choosing Stay. Successful saves remove the warning.

### 2. Make document transitions safe under concurrent use

**Evidence:** In `backend/src/routes/documents.ts`, PUT checks DRAFT before entering its transaction, then updates by ID alone. DELETE also separates its status check from deletion. Conversion checks for an existing child before its transaction. Cancellation checks for active children before acquiring its row lock. Issue/cancel already lock their own document status, but the other paths do not consistently share that protection.

**Plan:** Lock and recheck the relevant document inside each write transaction. Serialize conversion and cancellation on the source document; enforce at most one active child per source/type while the current one-child business rule remains. Add a version token for draft and price edits so stale saves return a conflict with a useful reload/review action. Audit existing duplicate children before adding a uniqueness constraint.

**Acceptance:** Simultaneous edit/issue cannot change issued items; delete/issue cannot delete an issued document; two conversions cannot create duplicate active children; cancel/convert cannot leave an active child of a cancelled source. A second user's stale save cannot silently overwrite the first. Test with independent database connections.

### 3. Distinguish unavailable data from zero results

**Evidence:** `DashboardPage.tsx` converts failed document/stock requests to empty arrays. `CustomerPicker.tsx` turns a failed request into “no customers.” New-document company and preset-customer fetches also suppress failures.

**Plan:** Standardize loading, success-empty, error, and retry states. Keep dashboard errors independent so healthy widgets remain useful. Use “unavailable” for failed KPIs and show last-updated time if retaining stale values. Keep retry next to the affected content.

**Acceptance:** A stock API failure cannot display a healthy zero-low-stock count. A customer API failure cannot be mistaken for an empty address book. Retrying preserves entered form data.

## Priority 1: faster everyday work

### 4. Rework the document editor around entry and review

**Evidence:** Buyer fields start collapsed even on blank documents. Save/issue actions follow the items table. Preview sits below the editor until the `2xl` breakpoint. Invoice-like item tables have an 820px minimum width. Item inputs do not have explicit per-field accessible labels.

**Design:**

- A compact document header shows number, status, customer summary, and save state.
- Expand buyer details automatically for a blank buyer or a validation error; keep a selected customer's summary compact.
- Keep a sticky action bar with total in Toman, Save, and the appropriate next action. Keep cancellation in a secondary menu.
- Offer Entry / Preview views on laptops and phones; retain side-by-side preview where usable. Preserve the mounted full-width print surface for export.
- Focus quantity after adding a product; support predictable keyboard movement and quick repeated additions. Surface pack/unit information and stock availability where relevant.
- Use stable row IDs, per-row/per-field accessible names, inline validation, focus on the first invalid field, and undo for accidental row removal.
- Use mobile item cards or a focused row editor so entering quantity and price does not require repeated horizontal scrolling.
- Before issuance, show buyer, item count, total, missing information, and stock warnings. Clearly state that issuance locks the document.

**Acceptance:** Complete a representative 10-line invoice by keyboard; no hidden validation failures; primary actions remain reachable on short laptops and phones. Screen and PDF totals agree, with explicit currency units. Set a completion-time baseline before claiming a speed improvement.

### 5. Make the dashboard a role-specific task list

**Evidence:** Current cards combine all-time issued invoice value, document counts, and low stock. The chart covers the last 30 days. Report follow-up lists already identify unconverted proformas and invoices without goods issues, but reports are restricted to admin/accountant.

**Plan:** Add a clearly labeled date range and a “Needs attention” queue. Sales sees drafts and quotes awaiting conversion; warehouse sees invoices awaiting dispatch and low stock; accounting sees existing sales summaries and, later, unpaid invoices. Reuse follow-up logic through appropriately authorized task endpoints rather than granting sales/warehouse access to restricted reports. Link each task to its exact filtered list or document.

**Acceptance:** Every count states its period/status definition. A warehouse user can reach pending dispatch work without navigating through accounting reports. Loading failures never produce fake zero totals.

### 6. Unify list search, filters, and navigation state

**Evidence:** `CustomersPage.tsx` uses lowercase substring search, while the command palette and inventory use Persian normalization. Product/customer pickers use default Command filtering. Document/customer pagination is client-side; their full datasets are fetched first.

**Plan:** Use one normalization policy for Arabic/Persian yeh/kaf, Persian/Latin digits, and spacing. Preserve search, filters, sort, and page in the URL. Add document date-range and customer filters; make common states directly linkable. Standardize result counts, reset filters, retry, and empty states. Keep the price grid's existing keyboard editing behavior.

**Acceptance:** Equivalent Persian/Arabic spellings and digit forms find the same record in lists and pickers. Returning from a document restores list context. Invalid/empty pages recover sensibly after deletion or filter changes.

### 7. Add a customer workspace

**Evidence:** Customers currently function mainly as an address book with shortcuts into filtered document lists.

**Plan:** Add a customer detail route with contact information, document history across types, last transaction, issued sales total, and New proforma. Show a document-chain timeline so staff can follow the sale through dispatch. Add outstanding balance only after payment records exist.

**Acceptance:** Staff can answer “what did this customer order and has it shipped?” from one page without mistaking sales totals for money owed.

## Priority 2: complete the operational workflow

These are proposed capabilities, not confirmed defects. Establish actual business rules before schema implementation.

| Capability | Proposed scope | Dependency / decision |
| --- | --- | --- |
| Payments and receivables | Receipts, invoice allocation, partial settlement, due dates, overdue list, reversal history | Confirm payment methods, opening balances, credit terms, and who may record/reverse payments; keep settlement separate from document status |
| Partial dispatch and returns | Track ordered, dispatched, remaining, and returned quantities per source line | Replace the current one-active-child conversion rule deliberately; prevent cumulative over-dispatch; define return authorization and stock reversal |
| Price selection | Explicit retail/partner price choice, with a visible source and controlled override | Product picker currently inserts `unitPrice`; confirm eligibility and whether manual discounts require authorization |
| Purchasing / replenishment | Supplier records, purchase orders, multi-line receiving, suggested reorder quantities | Validate demand first; current receipts and stock thresholds already support a simpler workflow |
| Activity history | Who changed prices, adjusted stock, issued/cancelled documents, and recorded payments, with reasons | Preserve existing actor stamps; introduce a durable append-only event history where needed |

Start with customer history and clearer dispatch tracking. Prioritize payments next if this app is expected to manage collections; otherwise keep it focused on sales documents and stock.

## UI consistency and accessibility

- Preserve the grey/red brand and current Persian typography/digit policy. Refine hierarchy, spacing, and density rather than replacing the design system.
- Establish shared page headers, list toolbars, status badges, error/retry blocks, and form-field validation patterns. The document form currently duplicates status styling instead of sharing its list badge.
- Treat the English sidebar group headings as a design preference to validate, not a functional bug. Persian labels may improve consistency for the intended operators.
- Add meaningful labels to line-item inputs and expanded state to picker triggers; verify focus returns to the invoking control after dialogs.
- Check RTL logical spacing in pickers and numeric alignment in tables. Preserve intentional LTR treatment for codes, phone numbers, and amounts.
- Test compact forms at 200% zoom and short viewport heights. `FormDialog` currently constrains scrolling only below `sm`; add a height-based fallback if controls become unreachable while retaining the compact desktop layout.
- Keep visible focus, status text in addition to color, sufficient target sizes, and reduced-motion behavior. Contrast and touch usability require rendered verification.

## Performance, PDF, and maintenance

1. **Bounded list APIs:** document lists currently load all matching documents and related data. Add validated pagination/filter/sort parameters and compact summaries; load items only on detail/export. Update the command palette and dashboard so they no longer rely on unbounded lists.
2. **Complete inventory history:** the movements API caps results at 2,000, while the UI pages the returned array. Add server pagination, date controls, total/has-more metadata, and export so older movements remain reachable.
3. **Dashboard summary endpoint:** calculate counts and chart series server-side rather than transferring every document. Preserve per-role access and the existing totals definitions.
4. **Route code splitting:** `App.tsx` eagerly imports pages. Split heavier reports/public-site/editor routes, then measure initial navigation and avoid introducing loading waterfalls. PDF libraries already use dynamic imports.
5. **Row-aware PDF pagination:** `exportPdf.ts` shifts one tall raster image by A4 page heights. Long rows can cross arbitrary cuts. Lay out whole rows across page-sized sheets, repeat headers, and keep totals/signatures together while preserving DOM capture and Persian shaping.
6. **Verification foundation:** add targeted lifecycle/concurrency, totals/rounding, Persian input/search, CSV round-trip, authorization, and critical navigation tests. Keep frontend/backend/SQL report formulas consistent.
7. **Operational documentation:** repair the outdated Prisma/setup instructions and add versioned database migrations. The real implementation uses `pg` and startup schema SQL, including incremental ALTER statements; it needs an explicit, reproducible upgrade history.

## Delivery sequence

Each stage should be a separately reviewable change. Order indicates dependencies, not a time estimate.

| Stage | Deliverables | Exit criteria |
| --- | --- | --- |
| 1 — Trust | Dirty guards; honest error states; transactional lifecycle fixes; stale-write protection | Navigation and concurrent-write regression scenarios pass; builds pass |
| 2 — Document entry | Sticky totals/actions; buyer defaults; inline validation; consistent picker search; mobile entry/preview | Representative invoice and goods-issue tasks pass keyboard, RTL, short-screen, and mobile QA |
| 3 — Daily workspace | Role task queues; persistent list filters; customer detail/history; paginated summary APIs | Counts reconcile with documents; users can resume work and access older records |
| 4 — Output and performance | Row-aware PDFs; route splitting; shared states/components; updated setup docs | Long PDFs are readable; measured initial bundle improves; setup is reproducible |
| 5 — Business expansion | Selected payments, partial dispatch/returns, or purchasing scope | Agreed domain rules, migration plan, permissions, reconciliation tests, and user acceptance |

## Verification checklist for implementation

- Use an isolated test database and representative Persian records; do not seed or mutate production for QA.
- Test ADMIN, SALES, WAREHOUSE, and ACCOUNTANT, including API rejection of unauthorized writes.
- Exercise create → save → issue → convert → dispatch → cancel, plus concurrent variants and failed requests.
- Test 390px phone width, 1280×720 laptop, short 1280×529 window, wide desktop, 200% zoom, both themes, and keyboard-only use.
- Export each document type with 1, 17, and 40 rows, long Persian names, large totals, and page-boundary rows. Check currency conversion, complete rows, and totals/signatures.
- Verify empty, loading, failed, stale, unauthorized, conflict, and successful states with real interactions.
- Measure document task completion, correction rate, requests/payload per list, and initial bundle size against a recorded baseline.

## Decisions to validate with operators

The first two stages can proceed without changing the domain model. Later scope depends on whether collections are managed here, whether split deliveries and returns are common, how partner pricing is assigned, and which devices warehouse staff use. Observe a sales operator creating a real-shaped invoice and a warehouse operator completing a dispatch before finalizing those additions.
