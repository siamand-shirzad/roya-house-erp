import { Trash } from "lucide-react";
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
import { formatToman, toDisplayDigits } from "@/lib/format";
import { computeLineTotal } from "@/lib/totals";

export function ItemsEditor({
  type,
  items,
  onChange,
  disabled,
}: {
  type: DocumentType;
  items: DocumentItem[];
  onChange: (items: DocumentItem[]) => void;
  disabled?: boolean;
}) {
  const isInvoiceLike = type === "INVOICE" || type === "PROFORMA";

  function addProduct(product: Product) {
    onChange([
      ...items,
      {
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
  }

  function updateItem(idx: number, patch: Partial<DocumentItem>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {!disabled && <ProductPicker onSelect={addProduct} />}

      <div className="rounded-md border overflow-x-auto">
        {/* Min width keeps inputs usable on narrow screens; the wrapper scrolls instead. */}
        <Table className={isInvoiceLike ? "min-w-[820px]" : "min-w-[560px]"}>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-48">نام کالا</TableHead>
              <TableHead className="w-28">واحد</TableHead>
              <TableHead className="w-24">تعداد</TableHead>
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
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={(isInvoiceLike ? 9 : 6) - (disabled ? 1 : 0)}
                  className="text-center text-muted-foreground py-6"
                >
                  هنوز کالایی اضافه نشده است.
                </TableCell>
              </TableRow>
            )}
            {items.map((item, idx) => {
              const t = computeLineTotal(item);
              return (
                <TableRow key={idx}>
                  <TableCell className="text-muted-foreground tabular-nums">{toDisplayDigits(idx + 1)}</TableCell>
                  <TableCell>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      disabled={disabled}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      disabled={disabled}
                    />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      decimals
                      value={item.quantity}
                      onValueChange={(v) => updateItem(idx, { quantity: v ?? 0 })}
                      disabled={disabled}
                    />
                  </TableCell>
                  {isInvoiceLike ? (
                    <>
                      <TableCell>
                        <NumberInput
                          value={item.unitPrice}
                          onValueChange={(v) => updateItem(idx, { unitPrice: v ?? 0 })}
                          disabled={disabled}
                        />
                      </TableCell>
                      <TableCell>
                        <NumberInput
                          value={item.discount ?? 0}
                          onValueChange={(v) => updateItem(idx, { discount: v ?? 0 })}
                          disabled={disabled}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.taxRate ?? 0}
                          onChange={(e) => updateItem(idx, { taxRate: Number(e.target.value) })}
                          disabled={disabled}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        {formatToman(t.grandTotal)}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell>
                      <Input
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
