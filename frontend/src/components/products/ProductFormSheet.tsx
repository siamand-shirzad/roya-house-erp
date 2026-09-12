import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { parseAmount } from "@/lib/csv";
import { toDisplayDigits } from "@/lib/format";
import { CategoryIcon } from "@/lib/icons";
import { CATEGORY_LABELS, type Product, type ProductCategory } from "@/types";

// One sheet for both "new product" and "edit product"; `product` decides which.
// Prices are Toman integers, the same unit the price list is stored in.

type FormState = {
  code: string;
  name: string;
  category: ProductCategory;
  spec: string;
  unit: string;
  unitPrice: string;
  partnerPrice: string;
  packSize: string;
  active: boolean;
};

const EMPTY: FormState = {
  code: "",
  name: "",
  category: "GYPSUM_PANEL",
  spec: "",
  unit: "",
  unitPrice: "",
  partnerPrice: "",
  packSize: "",
  active: true,
};

function toForm(p: Product): FormState {
  return {
    code: p.code ?? "",
    name: p.name,
    category: p.category,
    spec: p.spec ?? "",
    unit: p.unit,
    unitPrice: toDisplayDigits(p.unitPrice),
    partnerPrice: p.partnerPrice === null ? "" : toDisplayDigits(p.partnerPrice),
    packSize: p.packSize === null ? "" : toDisplayDigits(p.packSize),
    active: p.active,
  };
}

export function ProductFormSheet({
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

  // Reset every time the sheet opens, so a half-filled form never carries over.
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

    const unitPrice = parseAmount(form.unitPrice);
    if (unitPrice === null || Number.isNaN(unitPrice)) return setError("قیمت واحد را به عدد وارد کنید.");

    const partnerPrice = parseAmount(form.partnerPrice);
    if (Number.isNaN(partnerPrice)) return setError("قیمت همکاری را به عدد وارد کنید یا خالی بگذارید.");

    const packSize = parseAmount(form.packSize);
    if (Number.isNaN(packSize)) return setError("تعداد در بسته را به عدد وارد کنید یا خالی بگذارید.");
    if (packSize !== null && packSize < 1) return setError("تعداد در بسته باید بیشتر از صفر باشد.");

    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        category: form.category,
        spec: form.spec.trim() || null,
        unit: form.unit.trim(),
        unitPrice,
        partnerPrice,
        packSize,
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
    <Sheet open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{product ? "ویرایش کالا" : "کالای جدید"}</SheetTitle>
          <SheetDescription>
            {product
              ? "تغییر مشخصات کالا. قیمت‌ها را می‌توانید از خود جدول هم ویرایش کنید."
              : "کالای تازه به کاتالوگ اضافه می‌شود و بلافاصله در فرم اسناد قابل انتخاب است."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 p-4">
            <div className="grid gap-2">
              <Label htmlFor="product-name">نام کالا</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-code">کد کالا (اختیاری)</Label>
              <Input
                id="product-code"
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                dir="ltr"
                className="font-mono"
                placeholder="GYP-001"
              />
              <p className="text-xs text-muted-foreground">
                کد باید یکتا باشد؛ ورود و خروجی CSV کالاها را با همین کد تطبیق می‌دهد.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-category">دسته‌بندی</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v as ProductCategory)}>
                <SelectTrigger id="product-category" className="w-full">
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

            <div className="grid gap-2">
              <Label htmlFor="product-unit">واحد</Label>
              <Input
                id="product-unit"
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

            <div className="grid gap-2">
              <Label htmlFor="product-spec">مشخصات (اختیاری)</Label>
              <Textarea
                id="product-spec"
                value={form.spec}
                onChange={(e) => set("spec", e.target.value)}
                rows={2}
                placeholder="240×120×12.5 سانتی‌متر"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="product-price">قیمت واحد (تومان)</Label>
                <Input
                  id="product-price"
                  value={form.unitPrice}
                  onChange={(e) => set("unitPrice", e.target.value)}
                  inputMode="numeric"
                  className="tabular-nums"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-partner-price">قیمت همکاری (اختیاری)</Label>
                <Input
                  id="product-partner-price"
                  value={form.partnerPrice}
                  onChange={(e) => set("partnerPrice", e.target.value)}
                  inputMode="numeric"
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-pack">تعداد در بسته (اختیاری)</Label>
              <Input
                id="product-pack"
                value={form.packSize}
                onChange={(e) => set("packSize", e.target.value)}
                inputMode="numeric"
                className="tabular-nums sm:w-40"
              />
            </div>

            {product && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="product-active"
                  checked={form.active}
                  onCheckedChange={(checked) => set("active", checked === true)}
                />
                <Label htmlFor="product-active" className="font-normal">
                  کالا فعال است و در فهرست و اسناد دیده می‌شود
                </Label>
              </div>
            )}

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
              {product ? "ذخیره تغییرات" : "افزودن کالا"}
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
