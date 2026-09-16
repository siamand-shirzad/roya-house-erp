import { can, type Module } from "@/lib/permissions";
import { SortableStockRow, StockDragHandle, StockSortContext, useStockOrder } from "@/components/inventory/sortable-stock";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Ellipsis,
  Download,
  ArrowUp,
  ArrowDown,
  History,
  PackagePlus,
  Ruler,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Warehouse,
  X,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { AdjustStockDialog, MinStockDialog, ReceiptDialog, type ReceiptSeed } from "@/components/inventory/InventoryDialogs";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadText, toCsv } from "@/lib/csv";
import { StockLevelBadge } from "@/components/inventory/StockLevelBadge";
import { ListPagination, usePagination } from "@/components/list-pagination";
import { SegmentedControl } from "@/components/segmented-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { formatJalaliDate, formatNumber, toDisplayDigits } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import { matchesSearch } from "@/lib/search";
import { stockLevel } from "@/lib/stock";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  DOCUMENT_TYPE_LABELS,
  MOVEMENT_KIND_LABELS,
  type StockMovement,
  type StockRow,
} from "@/types";

// Warehouse: stock on hand per product and the movement ledger behind it.
// URL state: ?tab=movements, ?product=<id> (ledger of one product), ?low=1.

type Tab = "stock" | "movements";
const PAGE_SIZE = 15;

const TH = "px-3 py-2.5 text-right font-medium";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" });

export function InventoryPage() {
  const { user } = useAuth();
  const canWrite = user ? can(user, "inventory", true) : false;
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "movements" ? "movements" : "stock";
  const lowOnly = params.get("low") === "1";
  const productFilter = params.get("product");

  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);
  const [hasMoreMoves, setHasMoreMoves] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSeed, setReceiptSeed] = useState<ReceiptSeed[]>([]);
  // Row checkboxes: bulk receipt, CSV export, movement history of one product.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [minEditing, setMinEditing] = useState<StockRow | null>(null);
  // Bumped after every write so both lists reload.
  const [version, setVersion] = useState(0);
  const movesContext = useRef("");
  movesContext.current = `${tab}|${productFilter}|${version}`;
  const reload = () => setVersion((v) => v + 1);

  function setQuery(patch: Record<string, string | null>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  }

  useEffect(() => {
    setStockLoading(true);
    api.inventory
      .stock()
      .then(setStock)
      .catch((err) => setError(`دریافت موجودی ناموفق بود: ${errorMessage(err)}`))
      .finally(() => setStockLoading(false));
  }, [version]);

  useEffect(() => {
    if (tab !== "movements") return;
    let cancelled = false;
    setMovesLoading(true);
    setError(null);
    api.inventory
      .movements({ productId: productFilter ?? undefined, limit: "200" })
      .then((rows) => { if (!cancelled) { setMovements(rows); setHasMoreMoves(rows.length === 200); } })
      .catch((err) => { if (!cancelled) setError(`دریافت گردش کالا ناموفق بود: ${errorMessage(err)}`); })
      .finally(() => { if (!cancelled) setMovesLoading(false); });
    return () => { cancelled = true; };
  }, [tab, productFilter, version]);

  async function loadMoreMoves() {
    const context = movesContext.current;
    setMoreLoading(true);
    setError(null);
    try {
      const rows = await api.inventory.movements({ productId: productFilter ?? undefined, offset: String(movements.length), limit: "200" });
      if (context !== movesContext.current) return;
      setMovements((current) => [...current, ...rows.filter((row) => !current.some((m) => m.id === row.id))]);
      setHasMoreMoves(rows.length === 200);
    } catch (err) { setError(errorMessage(err)); }
    finally { setMoreLoading(false); }
  }

  // Quick create in the header links here with ?receipt=1.
  const wantsReceipt = params.get("receipt") === "1";
  useEffect(() => {
    if (!wantsReceipt) return;
    if (canWrite) openReceipt([]);
    setQuery({ receipt: null });
  }, [wantsReceipt]);

  function openReceipt(seed: ReceiptSeed[]) {
    setReceiptSeed(seed);
    setReceiptOpen(true);
  }

  const lowCount = useMemo(() => stock.filter((r) => stockLevel(r) !== "ok").length, [stock]);

  const stockOrder = useStockOrder(user?.id, stock.map((r) => r.productId));
  const stockRows = useMemo(
    () =>
      stock.filter(
        (r) =>
          (!lowOnly || stockLevel(r) !== "ok") &&
          matchesSearch(`${r.name} ${r.code ?? ""} ${r.spec ?? ""} ${CATEGORY_LABELS[r.category]}`, q)
      ).sort((a, b) => stockOrder.order.indexOf(a.productId) - stockOrder.order.indexOf(b.productId)),
    [stock, lowOnly, q, stockOrder.order]
  );
  const moveRows = useMemo(
    () =>
      movements.filter((m) =>
        matchesSearch(
          `${m.productName} ${m.productCode ?? ""} ${m.reference ?? ""} ${m.document?.number ?? ""} ${MOVEMENT_KIND_LABELS[m.kind]} ${m.createdByName ?? ""}`,
          q
        )
      ),
    [movements, q]
  );

  const stockPager = usePagination(stockRows, `${q}|${lowOnly}`, PAGE_SIZE);
  const selectedRows = stock.filter((r) => selected.has(r.productId));
  const pageIds = stockPager.pageRows.map((r) => r.productId);
  const pageChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const pageSome = pageIds.some((id) => selected.has(id));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const togglePage = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) (on ? next.add(id) : next.delete(id));
      return next;
    });

  function exportSelected() {
    const rows = selectedRows.length ? selectedRows : stockRows;
    downloadText(
      "stock.csv",
      toCsv(
        ["کد کالا", "نام کالا", "دسته", "واحد", "موجودی", "حداقل", "آخرین فی خرید (تومان)"],
        rows.map((r) => [r.code ?? "", r.name, CATEGORY_LABELS[r.category], r.unit, r.onHand, r.minStock ?? "", r.costPrice ?? ""])
      )
    );
  }
  const movePager = usePagination(moveRows, `${q}|${productFilter}`, PAGE_SIZE);

  const filterName = productFilter
    ? (stock.find((r) => r.productId === productFilter)?.name ?? movements[0]?.productName ?? "کالا")
    : null;

  return (
    <AppShell
      title="موجودی و گردش"
      actions={
        canWrite && (
          <Button size="sm" onClick={() => openReceipt([])}>
            <PackagePlus /> ورود کالا
          </Button>
        )
      }
    >
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="بخش انبار"
            items={[
              { value: "stock", label: "موجودی", icon: <Warehouse /> },
              { value: "movements", label: "گردش کالا", icon: <History /> },
            ]}
            value={tab}
            onValueChange={(value) => setQuery({ tab: value === "stock" ? null : value })}
          />
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 right-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={tab === "stock" ? "جستجوی نام، کد یا دسته..." : "جستجوی کالا، مرجع یا شماره سند..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pr-8"
            />
          </div>
          {tab === "stock" && (
            <SegmentedControl
              size="sm"
              ariaLabel="فیلتر موجودی"
              items={[
                { value: "all", label: "همه" },
                { value: "low", label: `زیر حداقل (${toDisplayDigits(lowCount)})` },
              ]}
              value={lowOnly ? "low" : "all"}
              onValueChange={(value) => setQuery({ low: value === "low" ? "1" : null })}
            />
          )}
          {tab === "movements" && filterName && (
            <Badge variant="outline" className="gap-1 py-1">
              فقط: {filterName}
              <button
                type="button"
                onClick={() => setQuery({ product: null })}
                className="rounded-sm opacity-60 hover:opacity-100"
                title="نمایش همه کالاها"
              >
                <X className="size-3.5" />
                <span className="sr-only">نمایش همه کالاها</span>
              </button>
            </Badge>
          )}
          <span className="text-sm text-muted-foreground tabular-nums sm:ms-auto">
            {tab === "stock"
              ? `${toDisplayDigits(stockRows.length)} کالا`
              : `${toDisplayDigits(moveRows.length)} گردش`}
          </span>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {tab === "stock" ? (
          <>
            {selected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm" role="region" aria-label="عملیات گروهی">
                <span className="font-medium tabular-nums">{toDisplayDigits(selected.size)} کالا انتخاب شده</span>
                {canWrite && (
                  <Button size="sm" onClick={() => openReceipt(selectedRows)}>
                    <PackagePlus /> ورود کالا برای انتخاب‌شده‌ها
                  </Button>
                )}
                {selected.size === 1 && (
                  <Button size="sm" variant="outline" onClick={() => setQuery({ tab: "movements", product: [...selected][0] })}>
                    <History /> گردش این کالا
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={exportSelected}>
                  <Download /> خروجی CSV
                </Button>
                <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setSelected(new Set())}>
                  <X /> لغو انتخاب
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <p>کالاها را با چک‌باکس انتخاب کنید تا عملیات گروهی ظاهر شود. دستگیره را بکشید تا ترتیب را عوض کنید (در همین مرورگر ذخیره می‌شود).</p>
                <Button size="sm" variant="ghost" className="ms-auto" onClick={exportSelected}>
                  <Download /> خروجی CSV
                </Button>
              </div>
            )}
            <StockSortContext ids={stockPager.pageRows.map((r) => r.productId)} onMove={stockOrder.move}>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="mobile-data-table w-full md:min-w-[760px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="border-b">
                    <th className={cn(TH, "w-20")}>
                      <div className="flex items-center gap-2 ps-2">
                        <Checkbox
                          aria-label="انتخاب همه‌ی ردیف‌های این صفحه"
                          checked={pageChecked ? true : pageSome ? "indeterminate" : false}
                          onCheckedChange={(v) => togglePage(v === true)}
                        />
                      </div>
                    </th>
                    <th className={TH}>کالا</th>
                    <th className={cn(TH, "w-40")}>دسته</th>
                    <th className={cn(TH, "w-32")}>موجودی</th>
                    <th className={cn(TH, "w-28")}>حداقل</th>
                    <th className={cn(TH, "w-32")}>وضعیت</th>
                    <th className="w-12 px-3 py-2.5">
                      <span className="sr-only">عملیات</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stockLoading &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-3 py-3">
                            <Skeleton className="h-4 w-full max-w-28" />
                          </td>
                        ))}
                      </tr>
                    ))}

                  {!stockLoading && stockRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-14 text-center text-muted-foreground">
                        {lowOnly ? "کالایی زیر حداقل موجودی نیست." : "کالایی با این جستجو پیدا نشد."}
                      </td>
                    </tr>
                  )}

                  {!stockLoading &&
                    stockPager.pageRows.map((r) => (
                      <SortableStockRow key={r.productId} id={r.productId}>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <Checkbox
                              className="ms-2"
                              aria-label={`انتخاب ${r.name}`}
                              checked={selected.has(r.productId)}
                              onCheckedChange={(v) => toggle(r.productId, v === true)}
                            />
                            <StockDragHandle name={r.name} />
                          </div>
                        </td>
                        <td data-label="کالا" className="px-3 py-2 font-medium">
                          {r.name}
                          {r.spec && <div className="text-xs font-normal text-muted-foreground">{r.spec}</div>}
                          {r.code && <bdi dir="ltr" className="text-xs font-normal text-muted-foreground">{r.code}</bdi>}
                        </td>
                        <td data-label="دسته" className="px-3 py-2 text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CategoryIcon category={r.category} className="size-4" />
                            {CATEGORY_LABELS[r.category]}
                          </span>
                        </td>
                        <td data-label="موجودی" className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-1"><span
                            className={cn("font-semibold tabular-nums", r.onHand < 0 && "text-destructive")}
                            dir="ltr"
                          >
                            {formatNumber(r.onHand)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">{r.unit}</span>
                        </div></td>
                        <td data-label="حداقل" className="px-3 py-2 tabular-nums text-muted-foreground">
                          {r.minStock === null ? "—" : formatNumber(r.minStock)}
                        </td>
                        <td data-label="وضعیت" className="px-3 py-2">
                          {stockLevel(r) === "ok" ? <span className="text-muted-foreground">عادی</span> : <StockLevelBadge row={r} />}
                        </td>
                        <td className="px-1.5 py-1">
                          <DropdownMenu dir="rtl" modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`عملیات ${r.name}`}>
                                <Ellipsis />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-48">
                              <DropdownMenuItem
                                onSelect={() => setQuery({ tab: "movements", product: r.productId })}
                              >
                                <History /> گردش این کالا
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={stockRows[0]?.productId === r.productId} onSelect={() => stockOrder.move(r.productId, stockRows[stockRows.indexOf(r)-1]?.productId)}><ArrowUp /> یک ردیف بالاتر</DropdownMenuItem>
                              <DropdownMenuItem disabled={stockRows[stockRows.length - 1]?.productId === r.productId} onSelect={() => stockOrder.move(r.productId, stockRows[stockRows.indexOf(r)+1]?.productId)}><ArrowDown /> یک ردیف پایین‌تر</DropdownMenuItem>
                              {canWrite && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => setAdjusting(r)}>
                                    <SlidersHorizontal /> اصلاح موجودی
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setMinEditing(r)}>
                                    <Ruler /> حداقل موجودی
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </SortableStockRow>
                    ))}
                </tbody>
              </table>
            </div>
            </StockSortContext>
            {!stockLoading && (
              <ListPagination
                page={stockPager.page}
                pageCount={stockPager.pageCount}
                total={stockPager.total}
                pageSize={stockPager.pageSize}
                onPageChange={stockPager.setPage}
              />
            )}
          </>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="mobile-data-table w-full md:min-w-[820px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="border-b">
                    <th className={cn(TH, "w-36")}>تاریخ</th>
                    <th className={TH}>کالا</th>
                    <th className={cn(TH, "w-44")}>نوع</th>
                    <th className={cn(TH, "w-28")}>مقدار</th>
                    <th className={cn(TH, "w-56")}>مرجع</th>
                    <th className={cn(TH, "w-36")}>کاربر</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movesLoading &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-3 py-3">
                            <Skeleton className="h-4 w-full max-w-28" />
                          </td>
                        ))}
                      </tr>
                    ))}

                  {!movesLoading && moveRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-14 text-center text-muted-foreground">
                        {movements.length === 0
                          ? "هنوز گردشی ثبت نشده است. با «ورود کالا» یا «اصلاح موجودی» شروع کنید."
                          : "گردشی با این جستجو پیدا نشد."}
                      </td>
                    </tr>
                  )}

                  {!movesLoading &&
                    movePager.pageRows.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-muted/40">
                        <td data-label="تاریخ" className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatJalaliDate(new Date(m.createdAt))}{" "}
                          <span className="text-xs">{toDisplayDigits(timeOf(m.createdAt))}</span>
                        </td>
                        <td data-label="کالا" className="px-3 py-2 font-medium">
                          <button
                            type="button"
                            className="text-start hover:text-primary"
                            onClick={() => setQuery({ product: m.productId })}
                            title="فقط گردش این کالا"
                          >
                            {m.productName}
                          </button>
                        </td>
                        <td data-label="نوع" className="px-3 py-2">{MOVEMENT_KIND_LABELS[m.kind]}</td>
                        <td data-label="مقدار" className="px-3 py-2 whitespace-nowrap">
                          <span
                            dir="ltr"
                            className={cn(
                              "font-semibold tabular-nums",
                              m.quantity > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"
                            )}
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {formatNumber(m.quantity)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">{m.unit}</span>
                        </td>
                        <td data-label="مرجع" className="px-3 py-2 text-muted-foreground">
                          {m.supplierName && <div className="text-foreground">{m.supplierName}</div>}
                          {m.unitCost != null && <div className="text-xs tabular-nums">فی خرید {formatNumber(m.unitCost)} تومان</div>}
                          {m.document ? (
                            <Link
                              to={`/documents/${TYPE_TO_SLUG[m.document.type]}/${m.document.id}`}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {DOCUMENT_TYPE_LABELS[m.document.type].short} {toDisplayDigits(m.document.number)}
                            </Link>
                          ) : (
                            (m.reference ?? "—")
                          )}
                        </td>
                        <td data-label="کاربر" className="px-3 py-2 text-muted-foreground">{m.createdByName ?? "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!movesLoading && (
              <ListPagination
                page={movePager.page}
                pageCount={movePager.pageCount}
                total={movePager.total}
                pageSize={movePager.pageSize}
                onPageChange={movePager.setPage}
              />
            )}
            {!movesLoading && hasMoreMoves && <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button variant="outline" disabled={moreLoading} onClick={loadMoreMoves}>{moreLoading ? "در حال بارگذاری..." : "دریافت گردش‌های قدیمی‌تر"}</Button>
              <span className="text-muted-foreground">جستجو در {formatNumber(movements.length)} گردش دریافت‌شده انجام می‌شود.</span>
            </div>}
          </>
        )}
      </div>

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        seed={receiptSeed}
        onSaved={() => {
          setSelected(new Set());
          reload();
        }}
      />
      <AdjustStockDialog row={adjusting} onClose={() => setAdjusting(null)} onSaved={reload} />
      <MinStockDialog row={minEditing} onClose={() => setMinEditing(null)} onSaved={reload} />
    </AppShell>
  );
}
