import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { FIELD, FormDialog, INPUT, LABEL } from "@/components/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

// The same modal backs "new customer", "edit customer", and the shortcut on
// the document form that turns typed buyer details into a saved customer.

export type CustomerDraft = Partial<Omit<Customer, "id">>;

type FormState = {
  name: string;
  customerCode: string;
  nationalId: string;
  economicCode: string;
  registration: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  phone: string;
  fax: string;
};

const EMPTY: FormState = {
  name: "",
  customerCode: "",
  nationalId: "",
  economicCode: "",
  registration: "",
  province: "",
  city: "",
  address: "",
  postalCode: "",
  phone: "",
  fax: "",
};

function toForm(source: CustomerDraft): FormState {
  return {
    name: source.name ?? "",
    customerCode: source.customerCode ?? "",
    nationalId: source.nationalId ?? "",
    economicCode: source.economicCode ?? "",
    registration: source.registration ?? "",
    province: source.province ?? "",
    city: source.city ?? "",
    address: source.address ?? "",
    postalCode: source.postalCode ?? "",
    phone: source.phone ?? "",
    fax: source.fax ?? "",
  };
}

function trimmed(form: FormState) {
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(form)) out[key] = value.trim() || null;
  out.name = form.name.trim();
  return out;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  draft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create. */
  customer: Customer | null;
  /** Prefill for a new customer, e.g. the buyer typed on a document. */
  draft?: CustomerDraft;
  onSaved: (customer: Customer, mode: "created" | "updated") => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(customer ?? draft ?? {}));
    setError(null);
  }, [open, customer, draft]);

  const set = (key: keyof FormState) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("نام مشتری الزامی است.");

    setError(null);
    setSaving(true);
    try {
      const payload = trimmed(form);
      const saved = customer
        ? await api.customers.update(customer.id, payload)
        : await api.customers.create(payload);
      onSaved(saved, customer ? "updated" : "created");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Compact label + input; `span` widens it across the 4-column grid.
  const field = (id: keyof FormState, label: string, span?: string) => (
    <div className={cn(FIELD, span)}>
      <Label htmlFor={`customer-${id}`} className={LABEL}>
        {label}
      </Label>
      <Input id={`customer-${id}`} className={INPUT} value={form[id]} onChange={(e) => set(id)(e.target.value)} />
    </div>
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      size="lg"
      title={customer ? "ویرایش مشتری" : "مشتری جدید"}
      description="هنگام ساخت سند در فرم خریدار کپی می‌شود؛ تغییرش روی اسناد قبلی اثر ندارد."
      onSubmit={submit}
      footer={
        <>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" />}
            {customer ? "ذخیره تغییرات" : "افزودن مشتری"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-4">
        {field("name", "نام مشتری", "sm:col-span-2")}
        {field("customerCode", "کد مشتری")}
        {field("phone", "تلفن")}
        {field("nationalId", "شناسه ملی / کد ملی")}
        {field("economicCode", "شماره اقتصادی")}
        {field("registration", "شماره ثبت")}
        {field("fax", "نمابر")}
        {field("province", "استان")}
        {field("city", "شهرستان")}
        {field("postalCode", "کدپستی", "sm:col-span-2")}
        {field("address", "آدرس", "sm:col-span-4")}
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
