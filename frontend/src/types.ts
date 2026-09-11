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

export type Document = {
  id: string;
  type: DocumentType;
  number: number;
  status: DocumentStatus;
  issueDate: string;
  company: Company | null;
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
