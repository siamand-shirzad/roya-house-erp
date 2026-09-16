import { can } from "@/lib/permissions";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { FIELD, INPUT, LABEL } from "@/components/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Company } from "@/types";

// The seller block printed on every document (admin only). Documents link to
// this row, so a change shows on existing documents' PDFs too.

type FormState = Record<Exclude<keyof Company, "id" | "logoUrl">, string>;

const EMPTY: FormState = {
  name: "",
  legalName: "",
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

function toForm(company: Company | null): FormState {
  const form = { ...EMPTY };
  if (!company) return form;
  for (const key of Object.keys(EMPTY) as (keyof FormState)[]) form[key] = company[key] ?? "";
  return form;
}

export function CompanySettingsPage() {
  const { user } = useAuth();
  const canEdit = can(user, "company", true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.company
      .get()
      .then((company) => {
        const loaded = toForm(company);
        setForm(loaded);
        setSaved(loaded);
      })
      .catch((err) => setError(`دریافت اطلاعات شرکت ناموفق بود: ${errorMessage(err)}`))
      .finally(() => setLoading(false));
  }, []);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    if (!form.name.trim()) return setError("نام شرکت الزامی است.");
    setError(null);
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
      const next = toForm(await api.company.update({ ...payload, name: form.name.trim() }));
      setForm(next);
      setSaved(next);
      toast.success("اطلاعات شرکت ذخیره شد.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const field = (id: keyof FormState, label: string, span?: string, ltr = false) => (
    <div className={cn(FIELD, span)}>
      <Label htmlFor={`company-${id}`} className={LABEL}>
        {label}
      </Label>
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <Input
          id={`company-${id}`}
        readOnly={!canEdit}
          dir={ltr ? "ltr" : undefined}
          className={cn(INPUT, ltr && "text-right")}
          value={form[id]}
          onChange={(e) => setForm((prev) => ({ ...prev, [id]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <AppShell title="اطلاعات شرکت">
      <form onSubmit={submit} className="space-y-4 p-4 md:p-6">
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </span>
              مشخصات فروشنده
            </CardTitle>
            <CardDescription>
              این اطلاعات در بخش «مشخصات فروشنده» همه‌ی پیش‌فاکتورها، فاکتورها و حواله‌ها چاپ می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {field("name", "نام شرکت / فروشگاه", "sm:col-span-2")}
              {field("legalName", "نام حقوقی", "sm:col-span-2")}
              {field("nationalId", "شناسه ملی", undefined, true)}
              {field("economicCode", "شماره اقتصادی", undefined, true)}
              {field("registration", "شماره ثبت", undefined, true)}
              {field("postalCode", "کدپستی", undefined, true)}
              {field("province", "استان")}
              {field("city", "شهرستان")}
              {field("phone", "تلفن", undefined, true)}
              {field("fax", "نمابر", undefined, true)}
              {field("address", "آدرس", "sm:col-span-4")}
            </div>

            {error && (
              <Alert variant="destructive" className="py-2">
                <TriangleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!canEdit || loading || saving || !dirty}>
                {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                ذخیره
              </Button>
              {dirty && !saving && <span className="text-sm text-muted-foreground">تغییرات ذخیره نشده</span>}
            </div>
          </CardContent>
        </Card>
      </form>
    </AppShell>
  );
}
