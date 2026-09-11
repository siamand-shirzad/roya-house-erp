import type { DocumentItem, DocumentTotals } from "@/types";

export function computeLineTotal(item: DocumentItem) {
  const lineTotal = Math.round(item.quantity * item.unitPrice);
  const discount = item.discount ?? 0;
  const afterDiscount = lineTotal - discount;
  const taxRate = item.taxRate ?? 0;
  const taxAmount = Math.round((afterDiscount * taxRate) / 100);
  const grandTotal = afterDiscount + taxAmount;
  return { lineTotal, afterDiscount, taxAmount, grandTotal };
}

export function computeDocumentTotals(items: DocumentItem[]): DocumentTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  for (const item of items) {
    const t = computeLineTotal(item);
    subtotal += t.lineTotal;
    discountTotal += item.discount ?? 0;
    taxTotal += t.taxAmount;
    grandTotal += t.grandTotal;
  }

  return { subtotal, discountTotal, taxTotal, grandTotal };
}
