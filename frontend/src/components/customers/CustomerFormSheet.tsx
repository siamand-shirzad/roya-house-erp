import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import type { Customer } from "@/types";

// The same sheet backs "new customer", "edit customer", and the shortcut on the
// document form that turns typed buyer details into a saved customer.

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

export function CustomerFormSheet({
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

  const field = (id: keyof FormState, label: string) => (
    <div className="grid gap-2">
      <Label htmlFor={`customer-${id}`}>{label}</Label>
      <Input id={`customer-${id}`} value={form[id]} onChange={(e) => set(id)(e.target.value)} />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{customer ? "ویرایش مشتری" : "مشتری جدید"}</SheetTitle>
          <SheetDescription>
            این مشخصات هنگام ساخت سند در فرم خریدار کپی می‌شود؛ تغییر بعدی آن‌ها روی اسناد قبلی اثر ندارد.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 p-4">
            {field("name", "نام مشتری")}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("customerCode", "کد مشتری")}
              {field("phone", "تلفن")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("nationalId", "شناسه ملی / کد ملی")}
              {field("economicCode", "شماره اقتصادی")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("province", "استان")}
              {field("city", "شهرستان")}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-address">آدرس</Label>
              <Textarea
                id="customer-address"
                value={form.address}
                onChange={(e) => set("address")(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("postalCode", "کدپستی")}
              {field("registration", "شماره ثبت")}
            </div>
            {field("fax", "نمابر")}

            {error && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t">
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" />}
              {customer ? "ذخیره تغییرات" : "افزودن مشتری"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              انصراف
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
