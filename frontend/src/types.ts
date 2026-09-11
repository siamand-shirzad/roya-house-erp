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

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "مدیر سیستم",
  SALES: "فروش",
  WAREHOUSE: "انبار",
  ACCOUNTANT: "حسابداری",
};

export type User = {
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
export type AuthUser = Pick<User, "id" | "fullName" | "username" | "phone" | "role">;

/** Row shape accepted by POST /api/products/import (upsert by code). */
export type ProductImportRow = {
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

export type Customer = {
  id: string;
  name: string;
  customerCode: string | null;
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

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, { title: string; short: string }> = {
  PROFORMA: { title: "پیش فاکتور", short: "پ ف" },
  INVOICE: { title: "صورتحساب فروش کالا و خدمات", short: "فاکتور" },
  GOODS_ISSUE: { title: "حواله خروج از انبار کالا", short: "حواله" },
};

// Who may create/issue/cancel/convert each document type. UI-only mirror of
// the backend's WRITE_ROLES in backend/src/routes/documents.ts — hides
// buttons the user can't use; the API is the actual enforcement.
export const DOCUMENT_WRITE_ROLES: Record<DocumentType, UserRole[]> = {
  PROFORMA: ["ADMIN", "SALES"],
  INVOICE: ["ADMIN", "SALES"],
  GOODS_ISSUE: ["ADMIN", "WAREHOUSE"],
};

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
  id: string;
  type: DocumentType;
  number: number;
  status: DocumentStatus;
  issueDate: string;
  company: Company | null;
  createdByName?: string | null;
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
  items: DocumentItem[];
  totals: DocumentTotals;
};
