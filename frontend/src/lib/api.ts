import type {
  AuthUser,
  Company,
  Customer,
  CustomerBalance,
  Document,
  DocumentType,
  Product,
  ProductCategory,
  ProductImportRow,
  Payment,
  PaymentInput,
  SepidarSummary,
  SalesReport,
  StockMovement,
  StockRow,
  StockWarning,
  User,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

/** Fired when the API says the session is gone; AuthProvider listens and shows the login screen. */
export const UNAUTHORIZED_EVENT = "rh:unauthorized";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    /** The parsed JSON error body, e.g. `existing` on a 409 from /convert. */
    public body: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

/**
 * The 409 a document save gets when someone else changed that document after
 * this browser loaded it. Callers match on it to offer a reload instead of
 * just showing the error, so the exact string lives here next to its
 * translation rather than being repeated at the call site.
 */
export const STALE_WRITE = "This document was changed by someone else; reload it before saving again";

// The API answers in English; these are the messages it can return, so the UI
// never shows a raw server string to a Persian-speaking user. Anything missing
// here falls back to a message chosen by status code.
const SERVER_MESSAGES: Record<string, string> = {
  "Only issued proformas can be revised": "فقط پیش‌فاکتور صادرشده امکان ساخت نسخه اصلاحی دارد.",
  "Access to this section is not allowed": "به این بخش دسترسی ندارید.",
  "Prices changed since you loaded them; reload before saving": "قیمت‌ها همزمان تغییر کرده‌اند. تغییرات شما حفظ شده؛ پیش از ذخیره، قیمت‌های تازه را بررسی کنید.",
  "A document needs at least one item": "سند باید حداقل یک ردیف کالا داشته باشد.",
  "Already converted": "این سند قبلاً تبدیل شده است.",
  "At least one active admin is required": "حداقل یک مدیر فعال باید باقی بماند.",
  "Cancel the documents created from this one first":
    "ابتدا سندهایی که از این سند ساخته شده‌اند را باطل کنید.",
  "Current password is incorrect": "رمز عبور فعلی درست نیست.",
  "Customer has documents": "برای این مشتری سند ثبت شده و قابل حذف نیست.",
  "Customer has payments or receipts": "برای این طرف حساب دریافت یا رسید انبار ثبت شده و قابل حذف نیست.",
  "Cancel the payments recorded against this invoice first": "برای این فاکتور دریافت ثبت شده؛ ابتدا دریافت‌ها را باطل کنید.",
  "Payments can only be recorded against issued invoices": "دریافت فقط برای فاکتور صادرشده ثبت می‌شود.",
  "The invoice belongs to another customer": "این فاکتور متعلق به مشتری دیگری است.",
  "Invoice not found": "فاکتور پیدا نشد.",
  "Only an active cheque can change status": "وضعیت فقط برای چک فعال قابل تغییر است.",
  "Only an active payment can be cancelled": "این دریافت قبلاً باطل شده است.",
  "Only admins can download backups": "فقط مدیر سیستم می‌تواند پشتیبان بگیرد.",
  "Customer not found": "مشتری پیدا نشد.",
  "Document not found": "سند پیدا نشد.",
  "Duplicate product codes in file": "در فایل، کد کالای تکراری وجود دارد.",
  "Invalid username or password": "نام کاربری یا رمز عبور درست نیست.",
  "Issue the document before converting it": "برای تبدیل، اول سند را صادر کنید.",
  "Not allowed for your role": "نقش کاربری شما اجازه این کار را ندارد.",
  "Only draft documents can be edited": "فقط پیش‌نویس‌ها قابل ویرایش هستند.",
  "Only draft documents can be issued": "فقط پیش‌نویس‌ها قابل صدور هستند.",
  "Only drafts can be deleted; cancel issued documents instead":
    "فقط پیش‌نویس حذف می‌شود؛ سند صادرشده را باید باطل کرد.",
  "Only issued documents can be cancelled": "فقط سند صادرشده قابل ابطال است.",
  "Product code already exists": "کالای دیگری با این کد ثبت شده است.",
  "Product not found": "کالا پیدا نشد.",
  "Setup already completed": "راه‌اندازی اولیه قبلاً انجام شده است. صفحه را دوباره باز کنید.",
  "Some products were not found": "بعضی از کالاها پیدا نشدند.",
  [STALE_WRITE]: "این سند را همزمان شخص دیگری تغییر داده است. برای ادامه، صفحه را دوباره بارگذاری کنید.",
  "Too many failed attempts. Try again in a few minutes.":
    "تعداد تلاش‌های ناموفق زیاد بود. چند دقیقه بعد دوباره امتحان کنید.",
  "User not found": "کاربر پیدا نشد.",
  "Username already exists": "این نام کاربری قبلاً ثبت شده است.",
};

/** One Persian sentence for anything a failed call throws. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const known = SERVER_MESSAGES[err.message];
    if (known) return known;
    if (err.status === 400) return "اطلاعات وارد شده کامل یا معتبر نیست.";
    if (err.status === 401) return "نشست شما تمام شده است. دوباره وارد شوید.";
    if (err.status === 403) return "اجازه این کار را ندارید.";
    if (err.status === 404) return "مورد خواسته شده پیدا نشد.";
    if (err.status >= 500) return "خطای سرور. چند لحظه بعد دوباره تلاش کنید.";
    return err.message;
  }
  // A network failure or an aborted fetch; its message is English and unhelpful.
  return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // session cookie
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(body.error ?? `Request failed: ${res.status}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** "?a=1&b=2" from the params that have a value, or "". */
function queryString(params: Record<string, string | undefined | null>) {
  const qs = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => !!entry[1])
  ).toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  auth: {
    status: () => request<{ needsSetup: boolean }>("/auth/status"),
    me: () => request<AuthUser>("/auth/me"),
    login: (username: string, password: string) =>
      request<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    setup: (data: { fullName: string; username: string; password: string }) =>
      request<AuthUser>("/auth/setup", { method: "POST", body: JSON.stringify(data) }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  },
  public: {
    catalog: () => request<{ category: ProductCategory; count: number }[]>("/public/catalog"),
  },
  company: {
    get: () => request<Company | null>("/company"),
    update: (data: Partial<Omit<Company, "id" | "logoUrl">>) =>
      request<Company>("/company", { method: "PUT", body: JSON.stringify(data) }),
  },
  products: {
    list: (params?: { q?: string; category?: string; active?: "true" | "false" }) =>
      request<Product[]>(`/products${queryString(params ?? {})}`),
    get: (id: string) => request<Product>(`/products/${id}`),
    create: (data: Partial<Product>) =>
      request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Product>) =>
      request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<Product>(`/products/${id}`, { method: "DELETE" }),
    bulkUpdate: (updates: { id: string; unitPrice?: number; partnerPrice?: number | null; expectedUpdatedAt?: string }[]) =>
      request<{ updated: number }>("/products/bulk", {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      }),
    import: (rows: ProductImportRow[]) =>
      request<{ created: number; updated: number }>("/products/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      }),
  },
  users: {
    list: () => request<User[]>("/users"),
    create: (data: Partial<User> & { password?: string }) =>
      request<User>("/users", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<User> & { password?: string }) =>
      request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  },
  customers: {
    list: (q?: string, kind?: "CUSTOMER" | "SUPPLIER") =>
      request<Customer[]>(`/customers${queryString({ q, kind })}`),
    get: (id: string) => request<Customer>(`/customers/${id}`),
    create: (data: Partial<Customer>) =>
      request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Customer>) =>
      request<Customer>(`/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/customers/${id}`, { method: "DELETE" }),
  },
  reports: {
    sales: (range: { from?: string; to?: string }) => request<SalesReport>(`/reports${queryString(range)}`),
  },
  inventory: {
    stock: () => request<StockRow[]>("/inventory/stock"),
    movements: (params?: { productId?: string; from?: string; to?: string; offset?: string; limit?: string }) =>
      request<StockMovement[]>(`/inventory/movements${queryString(params ?? {})}`),
    receipt: (data: {
      reference?: string | null;
      supplierId?: string | null;
      items: { productId: string; quantity: number; unitCost?: number | null }[];
    }) =>
      request<{ created: number }>("/inventory/receipts", { method: "POST", body: JSON.stringify(data) }),
    adjust: (data: { productId: string; countedQuantity: number; reason: string }) =>
      request<{ before: number; after: number; difference: number }>("/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    setMinStock: (productId: string, minStock: number | null) =>
      request<{ productId: string; minStock: number | null }>("/inventory/min-stock", {
        method: "PATCH",
        body: JSON.stringify({ productId, minStock }),
      }),
  },
  payments: {
    list: (params?: {
      customerId?: string;
      documentId?: string;
      method?: string;
      chequeStatus?: string;
      from?: string;
      to?: string;
    }) => request<Payment[]>(`/payments${queryString(params ?? {})}`),
    balances: () => request<CustomerBalance[]>("/payments/balances"),
    create: (data: PaymentInput) => request<Payment>("/payments", { method: "POST", body: JSON.stringify(data) }),
    setChequeStatus: (id: string, status: NonNullable<Payment["chequeStatus"]>) =>
      request<Payment>(`/payments/${id}/cheque-status`, { method: "POST", body: JSON.stringify({ status }) }),
    cancel: (id: string, reason: string) =>
      request<Payment>(`/payments/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
  },
  exchange: {
    summary: () => request<SepidarSummary>("/exchange/sepidar/summary"),
    /** A download link; the session cookie goes along because the app and API share an origin (or CORS allows it). */
    url: (path: string, params?: { from?: string; to?: string }) =>
      `${BASE_URL}/exchange/${path}${queryString(params ?? {})}`,
  },
  documents: {
    company: () => request<Company | null>("/documents/company"),
    page: (params: { type?: DocumentType; customerId?: string; status?: string; q?: string; from?: string; to?: string; page?: string }) =>
      request<{ rows: Document[]; total: number; page: number; pageSize: number }>(`/documents/page${queryString(params)}`),
    list: (params?: { type?: DocumentType; customerId?: string; since?: string }) =>
      request<Document[]>(`/documents${queryString(params ?? {})}`),
    get: (id: string) => request<Document>(`/documents/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Document>("/documents", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Document>(`/documents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
    issue: (id: string) =>
      request<Document & { stockWarnings?: StockWarning[] }>(`/documents/${id}/issue`, { method: "POST" }),
    cancel: (id: string, reason?: string) =>
      request<Document>(`/documents/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    revise: (id: string) => request<Document>(`/documents/${id}/revise`, { method: "POST" }),
    convert: (id: string, to: DocumentType) =>
      request<Document>(`/documents/${id}/convert`, {
        method: "POST",
        body: JSON.stringify({ to }),
      }),
  },
};
