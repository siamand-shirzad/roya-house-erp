import { can, type Module } from "@/lib/permissions";
import { TableColumns, useTableColumns } from "@/components/table-columns";
import { SegmentedControl } from "@/components/segmented-control";
import { BRANDS, productBrand, type Brand } from "@/lib/brands";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Ellipsis,
  FileSpreadsheet,
  LoaderCircle,
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Save,
  Search,
  TriangleAlert,
  Undo2,
  Upload,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PriceCell } from "@/components/products/PriceCell";
import { ImportCsvDialog } from "@/components/products/ImportCsvDialog";
import { BulkAdjustPopover, type BulkAdjustment } from "@/components/products/BulkAdjustPopover";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { normalizeKey, readCsvFile, downloadText } from "@/lib/csv";
import { productsToCsv, previewProductCsv, type CsvPreview } from "@/lib/priceListCsv";
import { toJalali, toDisplayDigits } from "@/lib/format";
import { useUnsavedChangesBlocker } from "@/lib/unsaved-changes";
import { CATEGORY_LABELS, type Product, type ProductCategory } from "@/types";

type Draft = { unitPrice?: number; partnerPrice?: number | null };
type SortKey = "code" | "name" | "category" | "unitPrice" | "partnerPrice";


const COL_UNIT = 0;
const COL_PARTNER = 1;

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export function ProductsPage() {
  const { user } = useAuth();
  // The API only lets admins change products; others get a read-only list.
  const canEdit = can(user, "products", true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  // Failures stay on the page until they are dealt with; successes are
  // transient and go to a toast.
  const [error, setError] = useState<string | null>(null);

  // ?q= lets the command palette open the price list already filtered to one product.
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  useEffect(() => {
    const fromUrl = searchParams.get("q");
    if (fromUrl !== null) setQ(fromUrl);
  }, [searchParams]);
  const [category, setCategory] = useState<ProductCategory | "ALL">("ALL");
  const [showInactive, setShowInactive] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  // Add / edit / deactivate. Only admins ever see these; the API enforces it too.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deactivating, setDeactivating] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const columns = useTableColumns(`product-columns:${user?.id}`, ["code"]);
  const [brand, setBrand] = useState<Brand | "ALL">("ALL");
  const columnOptions = [{id:"code",label:"کد کالا"},{id:"category",label:"دسته‌بندی"},{id:"unit",label:"واحد"},{id:"unitPrice",label:"قیمت واحد"},{id:"partnerPrice",label:"قیمت همکاری"}];
  const colCount = 1 + columnOptions.filter((c) => columns.visible(c.id)).length + Number(canEdit);
  const units = useMemo(
    () => [...new Set(products.map((p) => p.unit).filter(Boolean))].sort(),
    [products]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await api.products.list());
    } catch (err) {
      setError(`دریافت فهرست کالاها ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyCount = Object.keys(drafts).length;

  // Unsaved price drafts hold navigation away from this page (links, the back
  // button, browser back) and warn on tab close.
  const { blocker } = useUnsavedChangesBlocker(dirtyCount > 0);

  /** "Save and leave" from the unsaved-changes dialog. */
  async function saveAndLeave() {
    if (await save()) {
      blocker.proceed?.();
      return;
    }
    // Cancel the navigation and close the dialog so the reason, which renders
    // on the page behind it, is readable.
    blocker.reset?.();
  }

  const current = useCallback(
    (p: Product) => ({
      unitPrice: drafts[p.id]?.unitPrice ?? p.unitPrice,
      partnerPrice: drafts[p.id] && "partnerPrice" in drafts[p.id] ? drafts[p.id].partnerPrice! : p.partnerPrice,
    }),
    [drafts]
  );

  const rows = useMemo(() => {
    const needle = normalizeKey(q);
    const list = products.filter(
      (p) =>
        (showInactive || p.active) &&
        (brand === "ALL" || productBrand(p) === brand) &&
        (category === "ALL" || p.category === category) &&
        (!needle || normalizeKey(`${p.code ?? ""} ${p.name} ${p.spec ?? ""}`).includes(needle))
    );
    if (sort) {
      // Sort by saved prices so a row doesn't jump away while it's being edited.
      const val = (p: Product): string | number =>
        sort.key === "unitPrice"
          ? p.unitPrice
          : sort.key === "partnerPrice"
            ? (p.partnerPrice ?? -1)
            : sort.key === "category"
              ? CATEGORY_LABELS[p.category]
              : ((p[sort.key] as string | null) ?? "");
      list.sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fa")) * sort.dir;
      });
    }
    return list;
  }, [products, q, category, showInactive, sort, brand]);

  function setPrice(p: Product, field: keyof Draft, value: number | null) {
    setError(null);
    setDrafts((prev) => {
      const next = { ...prev };
      const d = { ...next[p.id] };
      if ((value ?? null) === (p[field] ?? null)) delete d[field];
      else (d as Record<string, number | null>)[field] = value;
      if (Object.keys(d).length) next[p.id] = d;
      else delete next[p.id];
      return next;
    });
  }

  function applyBulk({ percent, target, roundTo }: BulkAdjustment) {
    const adjust = (v: number) => Math.max(0, Math.round((v * (1 + percent / 100)) / roundTo) * roundTo);
    for (const p of rows) {
      const c = current(p);
      if (target !== "partner") setPrice(p, "unitPrice", adjust(c.unitPrice));
      if (target !== "unit" && c.partnerPrice !== null) setPrice(p, "partnerPrice", adjust(c.partnerPrice));
    }
    toast.success(
      `تغییر ${percent > 0 ? "+" : ""}${toDisplayDigits(percent)}٪ روی ${toDisplayDigits(rows.length)} کالا اعمال شد.`,
      { description: "برای ثبت، «ذخیره» را بزنید." }
    );
  }

  /** Saves the price drafts. Returns whether they actually reached the server. */
  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updates = Object.entries(drafts).map(([id, d]) => ({ id, ...d, expectedUpdatedAt: products.find((p) => p.id === id)?.updatedAt }));
      await api.products.bulkUpdate(updates);
      setDrafts({});
      await load();
      toast.success(`قیمت ${toDisplayDigits(updates.length)} کالا ذخیره شد.`);
      return true;
    } catch (err) {
      setError(`ذخیره ناموفق بود: ${errorMessage(err)}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setFormOpen(true);
  }

  function onSaved(saved: Product, mode: "created" | "updated") {
    setProducts((list) =>
      mode === "created" ? [...list, saved] : list.map((p) => (p.id === saved.id ? saved : p))
    );
    if (mode === "updated") {
      toast.success(`«${saved.name}» ذخیره شد.`);
      return;
    }
    const filtered = q.trim() !== "" || category !== "ALL";
    toast.success(`«${saved.name}» به کاتالوگ اضافه شد.`, {
      description: filtered ? "با فیلترهای فعلی ممکن است در فهرست دیده نشود." : undefined,
      action: filtered
        ? {
            label: "پاک کردن فیلترها",
            onClick: () => {
              setQ("");
              setCategory("ALL");
            },
          }
        : undefined,
    });
  }

  async function deactivate(p: Product) {
    setBusyId(p.id);
    try {
      const updated = await api.products.remove(p.id);
      setProducts((list) => list.map((x) => (x.id === p.id ? updated : x)));
      setDeactivating(null);
      toast.success(`«${p.name}» غیرفعال شد.`, {
        description: showInactive ? undefined : "برای دیدنش «نمایش غیرفعال‌ها» را بزنید.",
      });
    } catch (err) {
      setDeactivating(null);
      setError(`غیرفعال کردن کالا ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(p: Product) {
    setBusyId(p.id);
    try {
      const updated = await api.products.update(p.id, { active: true });
      setProducts((list) => list.map((x) => (x.id === p.id ? updated : x)));
      toast.success(`«${p.name}» دوباره فعال شد.`);
    } catch (err) {
      setError(`فعال کردن کالا ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const { jy, jm, jd } = toJalali(new Date());
    const pad = (n: number) => String(n).padStart(2, "0");
    const sorted = [...products].sort(
      (a, b) => a.category.localeCompare(b.category) || (a.code ?? "").localeCompare(b.code ?? "")
    );
    downloadText(`roya-house-price-list-${jy}-${pad(jm)}-${pad(jd)}.csv`, productsToCsv(sorted));
  }

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    setImportFile(file.name);
    setPreview(null);
    setImportError(null);
    setImportOpen(true);
    try {
      setPreview(previewProductCsv(await readCsvFile(file), products));
    } catch (err) {
      setImportError(`خواندن فایل ناموفق بود: ${(err as Error).message}`);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function applyImport() {
    if (!preview) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await api.products.import(preview.rows);
      await load();
      setImportOpen(false);
      toast.success("ورود از CSV انجام شد.", {
        description: `${toDisplayDigits(res.created)} کالای جدید، ${toDisplayDigits(res.updated)} کالا به‌روزرسانی شد.`,
      });
    } catch (err) {
      setImportError(`اعمال تغییرات ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setImporting(false);
    }
  }

  const SortHeader = ({ k, children, className }: { k: SortKey; children: string; className?: string }) => {
    const active = sort?.key === k;
    const Icon = !active ? ArrowUpDown : sort!.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={cn("px-3 py-2.5 text-right font-medium", className)} aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => setSort(active && sort!.dir === -1 ? null : { key: k, dir: active ? -1 : 1 })}
        >
          {children}
          <Icon className={cn("size-3.5", !active && "opacity-40")} />
        </button>
      </th>
    );
  };

  return (
    <AppShell
      title="فهرست کالاها و قیمت‌ها"
      actions={
        <>
          {canEdit && (
            <Button size="sm" onClick={openCreate} disabled={loading}>
              <Plus /> کالای جدید
            </Button>
          )}
          {/* CSV in one menu keeps the header to a single primary action on narrow screens. */}
          <DropdownMenu dir="rtl" modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="خروجی و ورود CSV" disabled={loading}>
                <FileSpreadsheet />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem onSelect={exportCsv} disabled={!products.length}>
                <Download /> خروجی CSV
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onSelect={() => fileInput.current?.click()} disabled={dirtyCount > 0}>
                  <Upload /> ورود از CSV
                  {dirtyCount > 0 && <span className="ms-auto text-xs text-muted-foreground">اول ذخیره کنید</span>}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFileChosen(e.target.files?.[0])}
          />
        </>
      }
    >
      <div className="space-y-4 p-4 md:p-6">
        <SegmentedControl ariaLabel="برند کالا" className="w-full [&_button]:min-w-20 [&_button]:flex-1 [&_button]:justify-center [&_button]:py-3" value={brand} onValueChange={setBrand} items={[{value:"ALL",label:"همه برندها"}, ...Object.entries(BRANDS).map(([value,label]) => ({value:value as Brand,label}))]} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 right-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="جستجو در نام، کد یا مشخصات..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pr-8"
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory | "ALL")}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه دسته‌بندی‌ها</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Checkbox
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={(checked) => setShowInactive(checked === true)}
            />
            <Label htmlFor="show-inactive" className="cursor-pointer font-normal">
              نمایش غیرفعال‌ها
            </Label>
          </div>
          <TableColumns columns={columnOptions} {...columns} />
          {canEdit && <BulkAdjustPopover count={rows.length} onApply={applyBulk} />}
          <span className="text-sm text-muted-foreground tabular-nums sm:ms-auto">
            {toDisplayDigits(rows.length)} کالا
          </span>
        </div>

        {!canEdit && (
          <p className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            دسترسی شما به این بخش فقط مشاهده است. می‌توانید فهرست را ببینید و خروجی CSV بگیرید.
          </p>
        )}

        <p className={cn("hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", !canEdit && "hidden")}>
          <span>
            <Kbd>Tab</Kbd> خانه بعد
          </span>
          <span>
            <Kbd>Enter</Kbd> یا <Kbd>↓</Kbd> ردیف بعد
          </span>
          <span>
            <Kbd>Shift+Enter</Kbd> یا <Kbd>↑</Kbd> ردیف قبل
          </span>
          <span>
            <Kbd>Esc</Kbd> برگرداندن قیمت
          </span>
        </p>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto overflow-y-hidden">
            <table className="mobile-data-table w-full md:min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted/95 text-muted-foreground backdrop-blur">
                <tr className="border-b">
                  {columns.visible("code") && <SortHeader k="code" className="w-24">کد کالا</SortHeader>}
                  <SortHeader k="name">نام کالا</SortHeader>
                  {columns.visible("category") && <SortHeader k="category" className="w-36">دسته‌بندی</SortHeader>}
                  {columns.visible("unit") && <th className="w-28 px-3 py-2.5 text-right font-medium">واحد</th>}
                  {columns.visible("unitPrice") && <SortHeader k="unitPrice" className="w-40">قیمت واحد (تومان)</SortHeader>}
                  {columns.visible("partnerPrice") && <SortHeader k="partnerPrice" className="w-40">قیمت همکاری (تومان)</SortHeader>}
                  {canEdit && (
                    <th className="w-12 px-3 py-2.5">
                      <span className="sr-only">عملیات</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: colCount }).map((__, j) => (
                        <td key={j} className="px-3 py-3">
                          <Skeleton className="h-4 w-full max-w-28" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="px-3 py-12 text-center text-muted-foreground">
                      کالایی با این فیلترها پیدا نشد.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((p, i) => {
                    const c = current(p);
                    const dirty = !!drafts[p.id];
                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "transition-colors hover:bg-muted/40 focus-within:bg-muted/40",
                          dirty && "bg-primary/[0.03]",
                          !p.active && "text-muted-foreground"
                        )}
                      >
                        {columns.visible("code") && <td data-label="کد کالا" className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground" dir="ltr">
                          <span className="block text-right">{p.code ?? "—"}</span>
                        </td>}
                        <td data-label="نام کالا" className="px-3 py-1.5">
                          <div className="flex items-center gap-2 font-medium">
                            {p.name}
                            {!p.active && <Badge variant="outline">غیرفعال</Badge>}
                          </div>
                          {p.spec && <div className="text-xs text-muted-foreground">{p.spec}</div>}
                        </td>
                        {columns.visible("category") && <td data-label="دسته‌بندی" className="px-3 py-1.5 text-xs">{CATEGORY_LABELS[p.category]}</td>}
                        {columns.visible("unit") && <td data-label="واحد"
                          className="px-3 py-1.5 text-xs"
                          title={p.packSize ? `${toDisplayDigits(p.packSize)} عدد در هر بسته` : undefined}
                        >
                          {p.unit}
                          {p.packSize ? (
                            <span className="text-muted-foreground tabular-nums"> ({toDisplayDigits(p.packSize)})</span>
                          ) : null}
                        </td>}
                        {columns.visible("unitPrice") && <td data-label="قیمت واحد (تومان)" className="px-1.5 py-1">
                          <PriceCell
                            readOnly={!canEdit}
                            row={i}
                            col={COL_UNIT}
                            value={c.unitPrice}
                            saved={p.unitPrice}
                            label={`قیمت واحد ${p.name}`}
                            onChange={(v) => setPrice(p, "unitPrice", v)}
                          />
                        </td>}
                        {columns.visible("partnerPrice") && <td data-label="قیمت همکاری (تومان)" className="px-1.5 py-1">
                          <PriceCell
                            readOnly={!canEdit}
                            row={i}
                            col={COL_PARTNER}
                            value={c.partnerPrice}
                            saved={p.partnerPrice}
                            nullable
                            label={`قیمت همکاری ${p.name}`}
                            onChange={(v) => setPrice(p, "partnerPrice", v)}
                          />
                        </td>}
                        {canEdit && (
                          <td className="px-1.5 py-1">
                            <DropdownMenu dir="rtl" modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={busyId === p.id}
                                  aria-label={`عملیات ${p.name}`}
                                >
                                  {busyId === p.id ? <LoaderCircle className="animate-spin" /> : <Ellipsis />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-44">
                                <DropdownMenuItem onSelect={() => openEdit(p)}>
                                  <Pencil /> ویرایش کالا
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {p.active ? (
                                  <DropdownMenuItem variant="destructive" onSelect={() => setDeactivating(p)}>
                                    <Archive /> غیرفعال کردن
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => reactivate(p)}>
                                    <ArchiveRestore /> فعال کردن دوباره
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        units={units}
        onSaved={onSaved}
      />

      <AlertDialog
        open={deactivating !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setDeactivating(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>«{deactivating?.name}» غیرفعال شود؟</AlertDialogTitle>
            <AlertDialogDescription>
              کالا حذف نمی‌شود: از فهرست قیمت و فرم اسناد کنار می‌رود، ولی اسناد قبلی دست نمی‌خورند.
              هر وقت بخواهی می‌توانی دوباره فعالش کنی.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId !== null}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                if (deactivating) deactivate(deactivating);
              }}
              disabled={busyId !== null}
            >
              {busyId !== null ? <LoaderCircle className="animate-spin" /> : <Archive />}
              غیرفعال کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leaving the page with price drafts pending pauses here first. */}
      <AlertDialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && !saving) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>قیمت‌های ذخیره‌نشده</AlertDialogTitle>
            <AlertDialogDescription>
              قیمت {toDisplayDigits(dirtyCount)} کالا تغییر کرده و هنوز ذخیره نشده است. با خروج بدون ذخیره، این
              تغییرها از بین می‌روند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>ماندن در این صفحه</AlertDialogCancel>
            <Button variant="outline" disabled={saving} onClick={() => blocker.proceed?.()}>
              <Undo2 /> خروج بدون ذخیره
            </Button>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                saveAndLeave();
              }}
            >
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />} ذخیره و خروج
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dirtyCount > 0 && (
        <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              قیمت {toDisplayDigits(dirtyCount)} کالا تغییر کرده و هنوز ذخیره نشده است.
            </span>
            <div className="ms-auto flex gap-2">
              <Button variant="outline" onClick={() => setDrafts({})} disabled={saving}>
                <Undo2 /> لغو همه
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />} ذخیره تغییرات
              </Button>
            </div>
          </div>
        </div>
      )}

      <ImportCsvDialog
        open={importOpen}
        onOpenChange={(o) => !importing && setImportOpen(o)}
        fileName={importFile}
        preview={preview}
        applying={importing}
        error={importError}
        onApply={applyImport}
      />
    </AppShell>
  );
}
