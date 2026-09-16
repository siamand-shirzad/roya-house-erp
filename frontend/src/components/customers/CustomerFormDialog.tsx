import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { FIELD, FormDialog, INPUT, LABEL } from "@/components/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PARTY_KIND_LABELS, type Customer, type PartyKind } from "@/types";

// The same modal backs "new customer", "edit customer", and the shortcut on
// the document form that turns typed buyer details into a saved customer.

export type CustomerDraft = Partial<Omit<Customer, "id">>;

type FormState = {
  partyKind: PartyKind;
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
  partyKind: "CUSTOMER",
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
    partyKind: source.partyKind ?? "CUSTOMER",
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
  out.partyKind = form.partyKind;
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

  const set = (key: Exclude<keyof FormState, "partyKind">) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("نام طرف حساب الزامی است.");

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
  const field = (id: Exclude<keyof FormState, "partyKind">, label: string, span?: string) => (
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
      title={customer ? "ویرایش طرف حساب" : "طرف حساب جدید"}
      description="مشتری یا تأمین‌کننده (مثل طرف حساب سپیدار). برای خروجی سپیدار، کد طرف حساب را همان کد سپیدار وارد کنید."
      onSubmit={submit}
      footer={
        <>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" />}
            {customer ? "ذخیره تغییرات" : "افزودن"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-4">
        {field("name", "نام", "sm:col-span-2")}
        {field("customerCode", "کد طرف حساب (سپیدار)")}
        <div className={FIELD}>
          <Label htmlFor="customer-partyKind" className={LABEL}>
            نوع
          </Label>
          <Select value={form.partyKind} onValueChange={(v) => setForm((prev) => ({ ...prev, partyKind: v as PartyKind }))}>
            <SelectTrigger id="customer-partyKind" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PARTY_KIND_LABELS) as PartyKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {PARTY_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {field("phone", "تلفن")}
        {field("nationalId", "شناسه ملی / کد ملی")}
        {field("economicCode", "شماره اقتصادی")}
        {field("registration", "شماره ثبت")}
        {field("fax", "نمابر")}
        {field("province", "استان")}
        {field("city", "شهرستان")}
        {field("postalCode", "کدپستی")}
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
