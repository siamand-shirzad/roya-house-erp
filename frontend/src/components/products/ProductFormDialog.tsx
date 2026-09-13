import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { FIELD, FormDialog, INPUT, LABEL } from "@/components/form-dialog";
import { NumberInput } from "@/components/number-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api";
import { CategoryIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type Product, type ProductCategory } from "@/types";

// One modal for both "new product" and "edit product"; `product` decides which.
// Prices are Toman integers, the same unit the price list is stored in.

type FormState = {
  code: string;
  name: string;
  category: ProductCategory;
  spec: string;
  unit: string;
  unitPrice: number | null;
  partnerPrice: number | null;
  packSize: number | null;
  active: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  category: "GYPSUM_PANEL",
  spec: "",
  unit: "",
  unitPrice: null,
  partnerPrice: null,
  packSize: null,
  active: true,
};

function toForm(p: Product): FormState {
  return {
    code: p.code ?? "",
    name: p.name,
    category: p.category,
    spec: p.spec ?? "",
    unit: p.unit,
    unitPrice: p.unitPrice,
    partnerPrice: p.partnerPrice,
    packSize: p.packSize,
    active: p.active,
  };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  units,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new product. */
  product: Product | null;
  /** Units already used in the catalog, offered as suggestions. */
  units: string[];
  onSaved: (product: Product, mode: "created" | "updated") => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset every time the dialog opens, so a half-filled form never carries over.
  useEffect(() => {
    if (!open) return;
    setForm(product ? toForm(product) : EMPTY);
    setError(null);
  }, [open, product]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("نام کالا الزامی است.");
    if (!form.unit.trim()) return setError("واحد کالا را وارد کنید (مثل مترمربع، شاخه، عدد).");
    if (form.unitPrice === null) return setError("قیمت واحد را وارد کنید.");
    if (form.packSize !== null && form.packSize < 1) return setError("تعداد در بسته باید بیشتر از صفر باشد.");

    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        category: form.category,
        spec: form.spec.trim() || null,
        unit: form.unit.trim(),
        unitPrice: form.unitPrice,
        partnerPrice: form.partnerPrice,
        packSize: form.packSize,
        active: form.active,
      };
      const saved = product
        ? await api.products.update(product.id, payload)
        : await api.products.create(payload);
      onSaved(saved, product ? "updated" : "created");
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
      title={product ? "ویرایش کالا" : "کالای جدید"}
      description={
        product
          ? "قیمت‌ها را از خود جدول هم می‌توانید ویرایش کنید."
          : "کالای تازه بلافاصله در فرم اسناد قابل انتخاب است."
      }
      onSubmit={submit}
      footer={
        <>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <LoaderCircle className="animate-spin" />}
            {product ? "ذخیره تغییرات" : "افزودن کالا"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-4">
        <div className={cn(FIELD, "sm:col-span-2")}>
          <Label htmlFor="product-name" className={LABEL}>
            نام کالا
          </Label>
          <Input
            id="product-name"
            className={INPUT}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor="product-code" className={LABEL}>
            کد کالا (یکتا، اختیاری)
          </Label>
          <Input
            id="product-code"
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            dir="ltr"
            className={cn(INPUT, "font-mono")}
            placeholder="GYP-001"
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor="product-category" className={LABEL}>
            دسته‌بندی
          </Label>
          <Select value={form.category} onValueChange={(v) => set("category", v as ProductCategory)}>
            <SelectTrigger id="product-category" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CATEGORY_LABELS) as ProductCategory[]).map((c) => (
                <SelectItem key={c} value={c}>
                  <CategoryIcon category={c} />
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={FIELD}>
          <Label htmlFor="product-unit" className={LABEL}>
            واحد
          </Label>
          <Input
            id="product-unit"
            className={INPUT}
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
            list="product-units"
            placeholder="مترمربع"
          />
          <datalist id="product-units">
            {units.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        <div className={FIELD}>
          <Label htmlFor="product-pack" className={LABEL}>
            تعداد در بسته
          </Label>
          <NumberInput
            id="product-pack"
            className={INPUT}
            value={form.packSize}
            onValueChange={(v) => set("packSize", v)}
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor="product-price" className={LABEL}>
            قیمت واحد (تومان)
          </Label>
          <NumberInput
            id="product-price"
            className={INPUT}
            value={form.unitPrice}
            onValueChange={(v) => set("unitPrice", v)}
          />
        </div>

        <div className={FIELD}>
          <Label htmlFor="product-partner-price" className={LABEL}>
            قیمت همکاری (تومان)
          </Label>
          <NumberInput
            id="product-partner-price"
            className={INPUT}
            value={form.partnerPrice}
            onValueChange={(v) => set("partnerPrice", v)}
          />
        </div>

        <div className={cn(FIELD, "sm:col-span-4")}>
          <Label htmlFor="product-spec" className={LABEL}>
            مشخصات (اختیاری)
          </Label>
          <Input
            id="product-spec"
            className={INPUT}
            value={form.spec}
            onChange={(e) => set("spec", e.target.value)}
            placeholder="240×120×12.5 سانتی‌متر"
          />
        </div>
      </div>

      {product && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="product-active"
            checked={form.active}
            onCheckedChange={(checked) => set("active", checked === true)}
          />
          <Label htmlFor="product-active" className="text-sm font-normal">
            کالا فعال است و در فهرست و اسناد دیده می‌شود
          </Label>
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="py-2">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </FormDialog>
  );
}
