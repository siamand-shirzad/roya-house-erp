// Shared totals logic for a document's line items, mirroring the columns on
// the Roya House paper templates:
//   مبلغ کل = unitPrice * quantity
//   مبلغ کل بعد از تخفیف = مبلغ کل - discount
//   جمع مالیات و عوارض = (مبلغ کل بعد از تخفیف) * taxRate / 100
//   جمع مبلغ کل بعلاوه مالیات و عوارض = مبلغ کل بعد از تخفیف + جمع مالیات و عوارض

export type LineItemInput = {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
};

export type LineItemTotals = {
  lineTotal: number;
  afterDiscount: number;
  taxAmount: number;
  grandTotal: number;
};

export function computeLineTotals(item: LineItemInput): LineItemTotals {
  const lineTotal = Math.round(item.quantity * item.unitPrice);
  const discount = item.discount ?? 0;
  const afterDiscount = lineTotal - discount;
  const taxRate = item.taxRate ?? 0;
  const taxAmount = Math.round((afterDiscount * taxRate) / 100);
  const grandTotal = afterDiscount + taxAmount;
  return { lineTotal, afterDiscount, taxAmount, grandTotal };
}

export function computeDocumentTotals(items: LineItemInput[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  for (const item of items) {
    const t = computeLineTotals(item);
    subtotal += t.lineTotal;
    discountTotal += item.discount ?? 0;
    taxTotal += t.taxAmount;
    grandTotal += t.grandTotal;
  }

  return { subtotal, discountTotal, taxTotal, grandTotal };
}
