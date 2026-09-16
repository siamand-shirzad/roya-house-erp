import { useRef, useState } from "react";
import { Trash, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/number-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductPicker } from "./ProductPicker";
import type { DocumentItem, DocumentType, Product } from "@/types";
import { formatNumber, formatToman, toDisplayDigits } from "@/lib/format";
import { computeLineTotal } from "@/lib/totals";
import { cn } from "@/lib/utils";

export function ItemsEditor({
  type,
  items,
  onChange,
  disabled,
  stock,
}: {
  type: DocumentType;
  items: DocumentItem[];
  onChange: (items: DocumentItem[]) => void;
  disabled?: boolean;
  /** Goods issues: stock on hand by product id, shown next to the quantity. */
  stock?: Map<string, number>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [removed, setRemoved] = useState<{ item: DocumentItem; index: number } | null>(null);
  const isInvoiceLike = type === "INVOICE" || type === "PROFORMA";
  const showStock = !isInvoiceLike && !!stock;
  const columnCount = (isInvoiceLike ? 8 : 5) + (showStock ? 1 : 0) + (disabled ? 0 : 1);
  // Total asked for per product, so two rows of the same product are compared together.
  const requested = new Map<string, number>();
  for (const it of items) if (it.productId) requested.set(it.productId, (requested.get(it.productId) ?? 0) + it.quantity);

  function addProduct(product: Product) {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        spec: product.spec ?? "",
        unit: product.unit,
        quantity: 1,
        unitPrice: product.unitPrice,
        discount: 0,
        taxRate: 0,
      },
    ]);
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>(`[data-item-row="${items.length}"] [data-quantity]`)?.focus());
  }

  function updateItem(idx: number, patch: Partial<DocumentItem>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setRemoved({ item: items[idx], index: idx });
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div ref={root} className="flex flex-col gap-3">
      {!disabled && <ProductPicker onSelect={addProduct} />}
      {removed && !disabled && (
        <div className="flex items-center justify-between gap-2 text-sm" role="status">
          <span>ردیف «{removed.item.name}» حذف شد.</span>
          <Button variant="outline" size="sm" onClick={() => {
            const next = [...items];
            next.splice(Math.min(removed.index, next.length), 0, removed.item);
            onChange(next);
            setRemoved(null);
          }}><Undo2 /> بازگردانی</Button>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        {/* Min width keeps inputs usable on narrow screens; the wrapper scrolls instead. */}
        <Table className={cn("max-md:block max-md:[&_td]:block max-md:[&_td]:before:mb-1 max-md:[&_td]:before:block max-md:[&_td]:before:text-xs max-md:[&_td]:before:text-muted-foreground max-md:[&_td]:before:content-[attr(data-label)]", isInvoiceLike ? "md:min-w-[820px]" : "md:min-w-[560px]")}>
          <TableHeader className="bg-muted/50 max-md:hidden">
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-48">نام کالا</TableHead>
              <TableHead className="w-28">واحد</TableHead>
              <TableHead className="w-24">تعداد</TableHead>
              {showStock && <TableHead className="w-24">موجودی</TableHead>}
              {isInvoiceLike && (
                <>
                  <TableHead className="w-32">قیمت واحد (ت)</TableHead>
                  <TableHead className="w-32">تخفیف (ت)</TableHead>
                  <TableHead className="w-24">مالیات %</TableHead>
                  <TableHead className="w-32">جمع (ت)</TableHead>
                </>
              )}
              {!isInvoiceLike && <TableHead>توضیحات</TableHead>}
              {!disabled && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody className="max-md:grid max-md:gap-3 max-md:p-3">
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
                  className="text-center text-muted-foreground py-6"
                >
                  هنوز کالایی اضافه نشده است.
                </TableCell>
              </TableRow>
            )}
            {items.map((item, idx) => {
              const t = computeLineTotal(item);
              return (
                <TableRow key={item.id ?? idx} data-item-row={idx} className="max-md:grid max-md:grid-cols-2 max-md:rounded-lg max-md:border max-md:p-1">
                  <TableCell className="text-muted-foreground tabular-nums">{toDisplayDigits(idx + 1)}</TableCell>
                  <TableCell data-label="نام کالا" className="max-md:col-span-2">
                    <Input
                      aria-label={`نام کالا، ردیف ${idx + 1}`}
                      aria-invalid={!item.name.trim()}
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      disabled={disabled}
                    />
                  </TableCell>
                  <TableCell data-label="واحد">
                    <Input
                      aria-label={`واحد، ردیف ${idx + 1}`}
                      aria-invalid={!item.unit.trim()}
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      disabled={disabled}
                    />
                  </TableCell>
                  <TableCell data-label="تعداد">
                    <NumberInput
                      data-quantity
                      aria-label={`تعداد، ردیف ${idx + 1}`}
                      aria-invalid={!(item.quantity > 0)}
                      decimals
                      value={item.quantity}
                      onValueChange={(v) => updateItem(idx, { quantity: v ?? 0 })}
                      disabled={disabled}
                    />
                  </TableCell>
                  {showStock && (
                    <TableCell
                      data-label="موجودی"
                      className={cn(
                        "whitespace-nowrap tabular-nums",
                        item.productId &&
                          (requested.get(item.productId) ?? 0) > (stock.get(item.productId) ?? 0) &&
                          "font-medium text-destructive"
                      )}
                      title={item.productId ? undefined : "کالای دستی؛ در انبار حساب نمی‌شود"}
                    >
                      {item.productId ? formatNumber(stock.get(item.productId) ?? 0) : "—"}
                    </TableCell>
                  )}
                  {isInvoiceLike ? (
                    <>
                      <TableCell data-label="قیمت واحد (تومان)">
                        <NumberInput
                          aria-label={`قیمت واحد به تومان، ردیف ${idx + 1}`}
                          value={item.unitPrice}
                          onValueChange={(v) => updateItem(idx, { unitPrice: v ?? 0 })}
                          disabled={disabled}
                        />
                      </TableCell>
                      <TableCell data-label="تخفیف (تومان)">
                        <NumberInput
                          aria-label={`تخفیف به تومان، ردیف ${idx + 1}`}
                          value={item.discount ?? 0}
                          onValueChange={(v) => updateItem(idx, { discount: v ?? 0 })}
                          disabled={disabled}
                        />
                      </TableCell>
                      <TableCell data-label="مالیات %">
                        <Input
                          aria-label={`درصد مالیات، ردیف ${idx + 1}`}
                          type="number"
                          min={0}
                          max={100}
                          value={item.taxRate ?? 0}
                          onChange={(e) => updateItem(idx, { taxRate: Number(e.target.value) })}
                          disabled={disabled}
                        />
                      </TableCell>
                      <TableCell data-label="جمع (تومان)" className="font-medium whitespace-nowrap">
                        {formatToman(t.grandTotal)}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell data-label="توضیحات" className="max-md:col-span-2">
                      <Input
                        aria-label={`توضیحات، ردیف ${idx + 1}`}
                        value={item.spec ?? ""}
                        onChange={(e) => updateItem(idx, { spec: e.target.value })}
                        disabled={disabled}
                      />
                    </TableCell>
                  )}
                  {!disabled && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(idx)}
                        aria-label="حذف ردیف"
                      >
                        <Trash className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
