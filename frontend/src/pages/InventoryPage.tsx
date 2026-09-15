import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Ellipsis,
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
import { AdjustStockDialog, MinStockDialog, ReceiptDialog } from "@/components/inventory/InventoryDialogs";
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
  INVENTORY_WRITE_ROLES,
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
  const canWrite = user ? INVENTORY_WRITE_ROLES.includes(user.role) : false;
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "movements" ? "movements" : "stock";
  const lowOnly = params.get("low") === "1";
  const productFilter = params.get("product");

  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movesLoading, setMovesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [minEditing, setMinEditing] = useState<StockRow | null>(null);
  // Bumped after every write so both lists reload.
  const [version, setVersion] = useState(0);
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
    setMovesLoading(true);
    api.inventory
      .movements(productFilter ? { productId: productFilter } : undefined)
      .then(setMovements)
      .catch((err) => setError(`دریافت گردش کالا ناموفق بود: ${errorMessage(err)}`))
      .finally(() => setMovesLoading(false));
  }, [tab, productFilter, version]);

  const lowCount = useMemo(() => stock.filter((r) => stockLevel(r) !== "ok").length, [stock]);

  const stockRows = useMemo(
    () =>
      stock.filter(
        (r) =>
          (!lowOnly || stockLevel(r) !== "ok") &&
          matchesSearch(`${r.name} ${r.code ?? ""} ${r.spec ?? ""} ${CATEGORY_LABELS[r.category]}`, q)
      ),
    [stock, lowOnly, q]
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
  const movePager = usePagination(moveRows, `${q}|${productFilter}`, PAGE_SIZE);

  const filterName = productFilter
    ? (stock.find((r) => r.productId === productFilter)?.name ?? movements[0]?.productName ?? "کالا")
    : null;

  return (
    <AppShell
      title="انبار"
      actions={
        canWrite && (
          <Button size="sm" onClick={() => setReceiptOpen(true)}>
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
                { value: "low", label: `کم‌موجود (${toDisplayDigits(lowCount)})` },
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
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="border-b">
                    <th className={cn(TH, "w-32")}>کد</th>
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
                        {lowOnly ? "کالای کم‌موجودی وجود ندارد." : "کالایی با این جستجو پیدا نشد."}
                      </td>
                    </tr>
                  )}

                  {!stockLoading &&
                    stockPager.pageRows.map((r) => (
                      <tr key={r.productId} className="transition-colors hover:bg-muted/40">
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground" dir="ltr">
                          <span className="block text-right">{r.code ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {r.name}
                          {r.spec && <div className="text-xs font-normal text-muted-foreground">{r.spec}</div>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <CategoryIcon category={r.category} className="size-4" />
                            {CATEGORY_LABELS[r.category]}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={cn("font-semibold tabular-nums", r.onHand < 0 && "text-destructive")}
                            dir="ltr"
                          >
                            {formatNumber(r.onHand)}
                          </span>{" "}
                          <span className="text-xs text-muted-foreground">{r.unit}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                          {r.minStock === null ? "—" : formatNumber(r.minStock)}
                        </td>
                        <td className="px-3 py-2">
                          <StockLevelBadge row={r} />
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
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
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
              <table className="w-full min-w-[820px] text-sm">
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
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatJalaliDate(new Date(m.createdAt))}{" "}
                          <span className="text-xs">{toDisplayDigits(timeOf(m.createdAt))}</span>
                        </td>
                        <td className="px-3 py-2 font-medium">
                          <button
                            type="button"
                            className="text-start hover:text-primary"
                            onClick={() => setQuery({ product: m.productId })}
                            title="فقط گردش این کالا"
                          >
                            {m.productName}
                          </button>
                        </td>
                        <td className="px-3 py-2">{MOVEMENT_KIND_LABELS[m.kind]}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
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
                        <td className="px-3 py-2 text-muted-foreground">
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
                        <td className="px-3 py-2 text-muted-foreground">{m.createdByName ?? "—"}</td>
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
          </>
        )}
      </div>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} onSaved={reload} />
      <AdjustStockDialog row={adjusting} onClose={() => setAdjusting(null)} onSaved={reload} />
      <MinStockDialog row={minEditing} onClose={() => setMinEditing(null)} onSaved={reload} />
    </AppShell>
  );
}
