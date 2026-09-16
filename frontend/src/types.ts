import type { Permissions } from "@/lib/permissions";
export type ProductCategory =
  | "GYPSUM_PANEL"
  | "METAL_STRUCTURE"
  | "GYPSUM_TILE"
  | "SPRI_ACCESSORY"
  | "SCREW_BOLT"
  | "TAPE_PUTTY"
  | "CONNECTOR"
  | "OTHER"
  | "BRAND_PANEL";

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  GYPSUM_PANEL: "پنل های گچی",
  METAL_STRUCTURE: "سازه های فلزی",
  GYPSUM_TILE: "تایل های گچی",
  SPRI_ACCESSORY: "سپری",
  SCREW_BOLT: "پیچ و بولت",
  TAPE_PUTTY: "نوار و بتونه",
  CONNECTOR: "اتصالات",
  OTHER: "سایر محصولات",
  BRAND_PANEL: "پنل های برند",
};

export type Product = {
  brand?: "BANA" | "GBOARD" | "ROYA" | "OTHER" | null;
  id: string;
  code: string | null;
  name: string;
  category: ProductCategory;
  spec: string | null;
  unit: string;
  unitPrice: number;
  partnerPrice: number | null;
  packSize: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserRole = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTANT";

/** Who may open /reports. UI mirror of the backend's requireRole on /api/reports. */
export const REPORT_ROLES: UserRole[] = ["ADMIN", "ACCOUNTANT"];

export type ReportFollowUpRow = {
  id: string;
  number: number;
  issueDate: string;
  buyerName: string | null;
  grandTotal: number;
  ageDays: number;
};

export type SalesReport = {
  range: { from: string | null; to: string | null };
  sales: {
    invoiceCount: number;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    grandTotal: number;
    averageInvoice: number;
  };
  profit: { costedAmount: number; costTotal: number; grossProfit: number; uncostedAmount: number };
  collections: { received: number; pendingCheques: number; count: number };
  proformas: { issued: number; converted: number };
  goodsIssues: { issued: number };
  daily: { day: string; count: number; grandTotal: number }[];
  topCustomers: { customerId: string | null; name: string; invoiceCount: number; grandTotal: number }[];
  topProducts: {
    productId: string | null;
    name: string;
    code: string | null;
    unit: string;
    category: ProductCategory | null;
    quantity: number;
    amount: number;
  }[];
  categories: { category: ProductCategory; amount: number }[];
  openProformas: { total: number; rows: ReportFollowUpRow[] };
  undeliveredInvoices: { total: number; rows: ReportFollowUpRow[] };
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "مدیر سیستم",
  SALES: "فروش",
  WAREHOUSE: "انبار",
  ACCOUNTANT: "حسابداری",
};

export type User = {
  permissions?: Permissions;
  id: string;
  fullName: string;
  username: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The signed-in user (GET /api/auth/me). */
export type AuthUser = Pick<User, "id" | "fullName" | "username" | "phone" | "role" | "permissions">;

/** Row shape accepted by POST /api/products/import (upsert by code). */
export type ProductImportRow = {
  brand?: Product["brand"];
  code: string;
  name: string;
  category: ProductCategory;
  spec?: string | null;
  unit: string;
  unitPrice: number;
  partnerPrice?: number | null;
  packSize?: number | null;
  active?: boolean;
};

/** Sepidar's طرف حساب: one list for customers and suppliers. */
export type PartyKind = "CUSTOMER" | "SUPPLIER" | "BOTH";
export const PARTY_KIND_LABELS: Record<PartyKind, string> = {
  CUSTOMER: "مشتری",
  SUPPLIER: "تأمین‌کننده",
  BOTH: "مشتری و تأمین‌کننده",
};

export type Customer = {
  id: string;
  name: string;
  customerCode: string | null;
  partyKind?: PartyKind;
  nationalId: string | null;
  economicCode: string | null;
  registration: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  fax: string | null;
};

export type Company = {
  id: string;
  name: string;
  legalName: string | null;
  nationalId: string | null;
  economicCode: string | null;
  registration: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  phone: string | null;
  fax: string | null;
  logoUrl: string | null;
};

export type DocumentType = "PROFORMA" | "INVOICE" | "GOODS_ISSUE";
export type DocumentStatus = "DRAFT" | "ISSUED" | "CANCELLED";

/** `title` is printed on the paper form, `name` is used in the UI, `short` in tight spots. */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, { title: string; name: string; short: string }> = {
  PROFORMA: { title: "پیش فاکتور", name: "پیش‌فاکتور", short: "پ ف" },
  INVOICE: { title: "صورتحساب فروش کالا و خدمات", name: "فاکتور فروش", short: "فاکتور" },
  GOODS_ISSUE: { title: "حواله خروج از انبار کالا", name: "حواله خروج", short: "حواله" },
};

// Who may create/issue/cancel/convert each document type. UI-only mirror of
// the backend's WRITE_ROLES in backend/src/routes/documents.ts — hides
// buttons the user can't use; the API is the actual enforcement.
export const DOCUMENT_WRITE_ROLES: Record<DocumentType, UserRole[]> = {
  PROFORMA: ["ADMIN", "SALES"],
  INVOICE: ["ADMIN", "SALES"],
  GOODS_ISSUE: ["ADMIN", "WAREHOUSE"],
};

/** Who may enter receipts, adjustments and minimum levels. UI mirror of routes/inventory.ts. */
export const INVENTORY_WRITE_ROLES: UserRole[] = ["ADMIN", "WAREHOUSE"];

export type StockRow = {
  productId: string;
  code: string | null;
  name: string;
  category: ProductCategory;
  spec: string | null;
  unit: string;
  onHand: number;
  minStock: number | null;
  /** Unit cost of the latest receipt that stated one (Toman). */
  costPrice?: number | null;
  lastMovementAt: string | null;
};

export type StockMovementKind = "RECEIPT" | "ISSUE" | "ISSUE_REVERSAL" | "ADJUSTMENT";

export const MOVEMENT_KIND_LABELS: Record<StockMovementKind, string> = {
  RECEIPT: "ورود کالا",
  ISSUE: "حواله خروج",
  ISSUE_REVERSAL: "برگشت حواله باطل‌شده",
  ADJUSTMENT: "اصلاح موجودی",
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  unit: string;
  kind: StockMovementKind;
  quantity: number;
  reference: string | null;
  supplierName?: string | null;
  unitCost?: number | null;
  document: { id: string; type: DocumentType; number: number } | null;
  createdByName: string | null;
  createdAt: string;
};

/** A product on a goods issue with less stock than the issue asks for. */
export type StockWarning = { productId: string; name: string; unit: string; available: number; requested: number };

export const NEXT_DOCUMENT_TYPE: Partial<Record<DocumentType, DocumentType>> = {
  PROFORMA: "INVOICE",
  INVOICE: "GOODS_ISSUE",
};

export type DocumentItem = {
  id?: string;
  productId?: string | null;
  name: string;
  spec?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
};

export type DocumentTotals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
};

export type DocumentLink = { id: string; type: DocumentType; number: number; status: DocumentStatus };

export type Document = {
  revisionOfId?: string | null;
  revisions?: { id: string; type: DocumentType; number: number; status: DocumentStatus }[];
  id: string;
  type: DocumentType;
  number: number;
  status: DocumentStatus;
  issueDate: string;
  company: Company | null;
  createdByName?: string | null;
  /** Last write time; sent back as `expectedUpdatedAt` on save so a stale
   *  edit (made against data someone else has since changed) is rejected
   *  instead of silently overwriting their edit. */
  updatedAt: string;
  issuedAt?: string | null;
  issuedByName?: string | null;
  cancelledAt?: string | null;
  cancelledByName?: string | null;
  cancelReason?: string | null;
  source?: DocumentLink | null;
  derived?: DocumentLink[];
  customer: Customer | null;
  buyerName: string | null;
  buyerNationalId: string | null;
  buyerEconomicCode: string | null;
  buyerProvince: string | null;
  buyerCity: string | null;
  buyerAddress: string | null;
  buyerPostalCode: string | null;
  buyerPhone: string | null;
  relatedInvoiceNo: string | null;
  vehiclePlate: string | null;
  vehicleColor: string | null;
  deliveredToName: string | null;
  deliveredToNationalId: string | null;
  notes: string | null;
  /** Proformas only: the last day the quoted prices hold (YYYY-MM-DD). */
  validUntil?: string | null;
  /** Invoices: money received against this invoice (counted payments). */
  paidAmount?: number;
  items: DocumentItem[];
  totals: DocumentTotals;
};

export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CHEQUE";
export type ChequeStatus = "PENDING" | "CLEARED" | "BOUNCED";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "نقد",
  CARD: "کارتخوان",
  TRANSFER: "حواله بانکی",
  CHEQUE: "چک",
};

export const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  PENDING: "در جریان وصول",
  CLEARED: "وصول‌شده",
  BOUNCED: "برگشتی",
};

/** A payment received (رسید دریافت). */
export type Payment = {
  id: string;
  number: number;
  customerId: string | null;
  customerName: string | null;
  document: { id: string; number: number; status: DocumentStatus } | null;
  payerName: string | null;
  method: PaymentMethod;
  amount: number;
  /** YYYY-MM-DD */
  paidAt: string;
  reference: string | null;
  chequeNumber: string | null;
  chequeBank: string | null;
  chequeDueDate: string | null;
  chequeStatus: ChequeStatus | null;
  notes: string | null;
  status: "ACTIVE" | "CANCELLED";
  cancelReason: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type PaymentInput = {
  customerId?: string | null;
  documentId?: string | null;
  payerName?: string | null;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  reference?: string | null;
  chequeNumber?: string | null;
  chequeBank?: string | null;
  chequeDueDate?: string | null;
  notes?: string | null;
};

export type CustomerBalance = {
  customerId: string;
  name: string;
  customerCode: string | null;
  phone: string | null;
  invoiced: number;
  paid: number;
  /** Positive: the customer owes us. */
  balance: number;
  pendingCheques: number;
};

export type SepidarSummary = {
  parties: number;
  partiesWithoutCode: number;
  products: number;
  productsWithoutCode: number;
  invoices: number;
  invoicesWithoutParty: number;
  payments: number;
};

export type PaymentState = { paid: number; due: number; state: "UNPAID" | "PARTIAL" | "PAID" };

/** An issued invoice's settlement, from its total and the money received; null for anything else. */
export function paymentState(doc: {
  type: DocumentType;
  status: DocumentStatus;
  paidAmount?: number;
  totals: DocumentTotals;
}): PaymentState | null {
  if (doc.type !== "INVOICE" || doc.status !== "ISSUED") return null;
  const paid = doc.paidAmount ?? 0;
  const due = doc.totals.grandTotal - paid;
  return { paid, due, state: paid <= 0 ? "UNPAID" : due <= 0 ? "PAID" : "PARTIAL" };
}
