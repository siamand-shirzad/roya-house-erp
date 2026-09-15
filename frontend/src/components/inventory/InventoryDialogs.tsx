import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, PackagePlus, Trash, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ProductPicker } from "@/components/documents/ProductPicker";
import { FIELD, FormDialog, INPUT, LABEL } from "@/components/form-dialog";
import { NumberInput } from "@/components/number-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { formatNumber, toDisplayDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product, StockRow } from "@/types";

// Receipts, stock counts and minimum levels (ADMIN / WAREHOUSE). Each writes
// stock movements through /api/inventory; the page reloads stock afterwards.

function ErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="py-2">
      <TriangleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

function Footer({ busy, label, onCancel, disabled }: { busy: boolean; label: string; onCancel: () => void; disabled?: boolean }) {
  return (
    <>
      <Button type="submit" size="sm" disabled={busy || disabled}>
        {busy && <LoaderCircle className="animate-spin" />}
        {label}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
        انصراف
      </Button>
    </>
  );
}

type ReceiptRow = { productId: string; name: string; code: string | null; unit: string; quantity: number | null };

export function ReceiptDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReference("");
    setRows([]);
    setError(null);
  }, [open]);

  function addProduct(p: Product) {
    setRows((prev) =>
      prev.some((r) => r.productId === p.id)
        ? prev
        : [...prev, { productId: p.id, name: p.name, code: p.code, unit: p.unit, quantity: null }]
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (rows.length === 0) return setError("حداقل یک کالا اضافه کنید.");
    const invalid = rows.findIndex((r) => !(r.quantity && r.quantity > 0));
    if (invalid !== -1) return setError(`ردیف ${toDisplayDigits(invalid + 1)}: تعداد باید بیشتر از صفر باشد.`);
    setError(null);
    setSaving(true);
    try {
      await api.inventory.receipt({
        reference: reference.trim() || null,
        items: rows.map((r) => ({ productId: r.productId, quantity: r.quantity! })),
      });
      toast.success(`ورود ${toDisplayDigits(rows.length)} کالا ثبت شد.`);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      size="lg"
      title="ورود کالا به انبار"
      description="کالاهای رسیده را با تعداد وارد کنید؛ به موجودی اضافه می‌شوند."
      onSubmit={submit}
      footer={<Footer busy={saving} label="ثبت ورود" onCancel={() => onOpenChange(false)} disabled={rows.length === 0} />}
    >
      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
        <div className={FIELD}>
          <Label htmlFor="receipt-reference" className={LABEL}>
            مرجع (تأمین‌کننده، شماره بارنامه یا فاکتور خرید)
          </Label>
          <Input
            id="receipt-reference"
            className={INPUT}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <ProductPicker onSelect={addProduct} />
      </div>

      {/* Only this list scrolls, so the dialog itself stays a fixed size. */}
      <div className="max-h-56 overflow-y-auto rounded-md border">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <PackagePlus className="size-5" />
            کالاها را از فهرست بالا اضافه کنید.
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row, idx) => (
              <li key={row.productId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="w-6 text-muted-foreground tabular-nums">{toDisplayDigits(idx + 1)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {row.name}
                  {/* Isolated LTR run, or a Latin code glues onto a name ending in Latin ("RGBRD-..."). */}
                  {row.code && (
                    <bdi dir="ltr" className="ms-2 text-xs text-muted-foreground">
                      {row.code}
                    </bdi>
                  )}
                </span>
                <NumberInput
                  decimals
                  aria-label={`تعداد ${row.name}`}
                  className={cn(INPUT, "w-28")}
                  value={row.quantity}
                  autoFocus={idx === rows.length - 1}
                  onValueChange={(v) =>
                    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, quantity: v } : r)))
                  }
                />
                <span className="w-14 truncate text-muted-foreground">{row.unit}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`حذف ${row.name}`}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ErrorAlert error={error} />
    </FormDialog>
  );
}

export function AdjustStockDialog({
  row,
  onClose,
  onSaved,
}: {
  row: StockRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [counted, setCounted] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setCounted(row.onHand);
    setReason("");
    setError(null);
  }, [row]);

  const difference = row && counted !== null ? Math.round((counted - row.onHand) * 100) / 100 : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    if (counted === null) return setError("مقدار شمارش‌شده را وارد کنید.");
    if (!reason.trim()) return setError("دلیل اصلاح را بنویسید (مثلاً «شمارش انبار» یا «موجودی اولیه»).");
    setError(null);
    setSaving(true);
    try {
      await api.inventory.adjust({ productId: row.productId, countedQuantity: counted, reason: reason.trim() });
      toast.success(`موجودی «${row.name}» اصلاح شد.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      busy={saving}
      title="اصلاح موجودی"
      description={row ? `${row.name} — موجودی ثبت‌شده: ${formatNumber(row.onHand)} ${row.unit}` : undefined}
      onSubmit={submit}
      footer={<Footer busy={saving} label="ثبت اصلاح" onCancel={onClose} disabled={difference === 0} />}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={FIELD}>
          <Label htmlFor="adjust-counted" className={LABEL}>
            موجودی واقعی (شمارش)
          </Label>
          <NumberInput id="adjust-counted" decimals className={INPUT} value={counted} onValueChange={setCounted} />
        </div>
        <div className={cn(FIELD, "sm:col-span-2")}>
          <Label htmlFor="adjust-reason" className={LABEL}>
            دلیل
          </Label>
          <Input
            id="adjust-reason"
            className={INPUT}
            placeholder="شمارش انبار، موجودی اولیه، خرابی..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        اختلاف:{" "}
        <span
          dir="ltr"
          className={cn(
            "font-medium tabular-nums",
            difference > 0 && "text-emerald-700 dark:text-emerald-300",
            difference < 0 && "text-destructive"
          )}
        >
          {difference > 0 ? "+" : ""}
          {formatNumber(difference)}
        </span>{" "}
        {row?.unit}
      </p>
      <ErrorAlert error={error} />
    </FormDialog>
  );
}

export function MinStockDialog({
  row,
  onClose,
  onSaved,
}: {
  row: StockRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setValue(row.minStock);
    setError(null);
  }, [row]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!row) return;
    setSaving(true);
    try {
      await api.inventory.setMinStock(row.productId, value);
      toast.success(`حداقل موجودی «${row.name}» ذخیره شد.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={row !== null}
      onOpenChange={(open) => !open && onClose()}
      busy={saving}
      title="حداقل موجودی"
      description={row ? `${row.name} — وقتی موجودی کمتر از این مقدار شود، «کم‌موجود» نشان داده می‌شود.` : undefined}
      onSubmit={submit}
      footer={<Footer busy={saving} label="ذخیره" onCancel={onClose} />}
    >
      <div className={cn(FIELD, "sm:w-1/2")}>
        <Label htmlFor="min-stock" className={LABEL}>
          حداقل ({row?.unit}) — خالی یعنی بدون هشدار
        </Label>
        <NumberInput id="min-stock" decimals className={INPUT} value={value} onValueChange={setValue} />
      </div>
      <ErrorAlert error={error} />
    </FormDialog>
  );
}
