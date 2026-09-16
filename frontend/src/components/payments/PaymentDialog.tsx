import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { CustomerPicker } from "@/components/documents/CustomerPicker";
import { FIELD, FormDialog, INPUT, LABEL } from "@/components/form-dialog";
import { invalidateHeaderAlerts } from "@/components/header/header-notifications";
import { NumberInput } from "@/components/number-input";
import { ShamsiDatePicker } from "@/components/shamsi-date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { formatToman, toDisplayDigits, toIsoDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type Payment, type PaymentMethod } from "@/types";

// "دریافت وجه" (Sepidar's رسید دریافت): who paid, how, how much, and — for a
// cheque — its number, bank and due date. Opened from the payments page, an
// issued invoice (pre-filled with its customer and remaining amount) or a
// customer's page.

export type PaymentPreset = {
  customer?: { id: string; name: string } | null;
  invoice?: { id: string; number: number; due: number } | null;
};

type Form = {
  customer: { id: string; name: string } | null;
  payerName: string;
  method: PaymentMethod;
  amount: number | null;
  paidAt: string;
  reference: string;
  chequeNumber: string;
  chequeBank: string;
  chequeDueDate: string;
  notes: string;
};

const blank = (preset?: PaymentPreset): Form => ({
  customer: preset?.customer ?? null,
  payerName: "",
  method: "TRANSFER",
  amount: preset?.invoice && preset.invoice.due > 0 ? preset.invoice.due : null,
  paidAt: toIsoDate(new Date()),
  reference: "",
  chequeNumber: "",
  chequeBank: "",
  chequeDueDate: "",
  notes: "",
});

export function PaymentDialog({
  open,
  onOpenChange,
  preset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: PaymentPreset;
  onSaved: (payment: Payment) => void;
}) {
  const [form, setForm] = useState<Form>(() => blank(preset));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(blank(preset));
    setError(null);
    // Reset only when the dialog opens; the preset object is rebuilt on every render.
  }, [open]);

  const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const cheque = form.method === "CHEQUE";
  const invoice = preset?.invoice ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.amount || form.amount <= 0) return setError("مبلغ دریافت را وارد کنید.");
    if (!form.customer && !invoice && !form.payerName.trim()) return setError("طرف حساب یا نام پرداخت‌کننده را وارد کنید.");
    if (cheque && (!form.chequeNumber.trim() || !form.chequeDueDate)) return setError("برای چک، شماره و تاریخ سررسید لازم است.");
    setError(null);
    setSaving(true);
    try {
      const saved = await api.payments.create({
        customerId: form.customer?.id ?? null,
        documentId: invoice?.id ?? null,
        payerName: form.payerName.trim() || null,
        method: form.method,
        amount: form.amount,
        paidAt: form.paidAt,
        reference: form.reference.trim() || null,
        chequeNumber: cheque ? form.chequeNumber.trim() : null,
        chequeBank: cheque ? form.chequeBank.trim() || null : null,
        chequeDueDate: cheque ? form.chequeDueDate : null,
        notes: form.notes.trim() || null,
      });
      invalidateHeaderAlerts();
      toast.success(`رسید دریافت ${toDisplayDigits(saved.number)} به مبلغ ${formatToman(saved.amount)} تومان ثبت شد.`);
      onSaved(saved);
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
      title={invoice ? `دریافت وجه فاکتور ${toDisplayDigits(invoice.number)}` : "دریافت وجه"}
      description={
        invoice
          ? `مانده این فاکتور: ${formatToman(Math.max(0, invoice.due))} تومان`
          : "مبلغ به تومان. چک تا وقتی برگشت نخورده، از مانده حساب کم می‌شود."
      }
      onSubmit={submit}
      footer={
        <>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" />}
            ثبت دریافت
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`${FIELD} sm:col-span-2`}>
          <span className={LABEL}>طرف حساب</span>
          {form.customer ? (
            <Badge variant="outline" className="h-8 w-fit gap-1 px-2 text-sm">
              {form.customer.name}
              {!invoice && (
                <button type="button" onClick={() => patch({ customer: null })} className="opacity-60 hover:opacity-100" title="حذف">
                  <X className="size-3.5" />
                  <span className="sr-only">حذف طرف حساب</span>
                </button>
              )}
            </Badge>
          ) : (
            <CustomerPicker
              kind="CUSTOMER"
              label="انتخاب مشتری..."
              className="h-8 w-full sm:w-full"
              onSelect={(c) => patch({ customer: { id: c.id, name: c.name } })}
            />
          )}
        </div>
        <div className={FIELD}>
          <Label htmlFor="pay-payer" className={LABEL}>
            نام پرداخت‌کننده (اختیاری)
          </Label>
          <Input id="pay-payer" className={INPUT} value={form.payerName} onChange={(e) => patch({ payerName: e.target.value })} />
        </div>

        <div className={FIELD}>
          <Label htmlFor="pay-method" className={LABEL}>
            نوع دریافت
          </Label>
          <Select value={form.method} onValueChange={(v) => patch({ method: v as PaymentMethod })}>
            <SelectTrigger id="pay-method" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={FIELD}>
          <Label htmlFor="pay-amount" className={LABEL}>
            مبلغ (تومان)
          </Label>
          <NumberInput id="pay-amount" className={INPUT} value={form.amount} onValueChange={(v) => patch({ amount: v })} />
        </div>
        <div className={FIELD}>
          <span className={LABEL}>تاریخ دریافت</span>
          <ShamsiDatePicker label="تاریخ" value={form.paidAt} onChange={(v) => patch({ paidAt: v || toIsoDate(new Date()) })} />
        </div>

        {cheque ? (
          <>
            <div className={FIELD}>
              <Label htmlFor="pay-cheque" className={LABEL}>
                شماره چک
              </Label>
              <Input id="pay-cheque" dir="ltr" className={INPUT} value={form.chequeNumber} onChange={(e) => patch({ chequeNumber: e.target.value })} />
            </div>
            <div className={FIELD}>
              <Label htmlFor="pay-bank" className={LABEL}>
                بانک
              </Label>
              <Input id="pay-bank" className={INPUT} value={form.chequeBank} onChange={(e) => patch({ chequeBank: e.target.value })} />
            </div>
            <div className={FIELD}>
              <span className={LABEL}>تاریخ سررسید</span>
              <ShamsiDatePicker label="سررسید" value={form.chequeDueDate} onChange={(v) => patch({ chequeDueDate: v })} />
            </div>
          </>
        ) : (
          <div className={`${FIELD} sm:col-span-3`}>
            <Label htmlFor="pay-ref" className={LABEL}>
              شماره پیگیری / مرجع
            </Label>
            <Input id="pay-ref" dir="ltr" className={INPUT} value={form.reference} onChange={(e) => patch({ reference: e.target.value })} />
          </div>
        )}

        <div className={`${FIELD} sm:col-span-3`}>
          <Label htmlFor="pay-notes" className={LABEL}>
            شرح (اختیاری)
          </Label>
          <Input id="pay-notes" className={INPUT} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="py-2">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </FormDialog>
  );
}
