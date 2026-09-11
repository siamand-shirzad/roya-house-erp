import type {
  AuthUser,
  Customer,
  Document,
  DocumentLink,
  DocumentType,
  Product,
  ProductCategory,
  ProductImportRow,
  User,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

/** Fired when the API says the session is gone; AuthProvider listens and shows the login screen. */
export const UNAUTHORIZED_EVENT = "rh:unauthorized";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
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
    throw new ApiError(body.error ?? `Request failed: ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
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
  },
  public: {
    catalog: () => request<{ category: ProductCategory; count: number }[]>("/public/catalog"),
  },
  products: {
    list: (params?: { q?: string; category?: string; active?: "true" | "false" }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request<Product[]>(`/products${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<Product>(`/products/${id}`),
    create: (data: Partial<Product>) =>
      request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Product>) =>
      request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<Product>(`/products/${id}`, { method: "DELETE" }),
    bulkUpdate: (updates: { id: string; unitPrice?: number; partnerPrice?: number | null }[]) =>
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
    list: (q?: string) => request<Customer[]>(`/customers${q ? `?q=${q}` : ""}`),
    get: (id: string) => request<Customer>(`/customers/${id}`),
    create: (data: Partial<Customer>) =>
      request<Customer>("/customers", { method: "POST", body: JSON.stringify(data) }),
  },
  documents: {
    list: (type?: DocumentType) => request<Document[]>(`/documents${type ? `?type=${type}` : ""}`),
    get: (id: string) => request<Document>(`/documents/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Document>("/documents", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Document>(`/documents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
    issue: (id: string) => request<Document>(`/documents/${id}/issue`, { method: "POST" }),
    cancel: (id: string, reason?: string) =>
      request<Document>(`/documents/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
    convert: (id: string, to: DocumentType) =>
      request<Document>(`/documents/${id}/convert`, {
        method: "POST",
        body: JSON.stringify({ to }),
      }) as Promise<Document & { existing?: DocumentLink }>,
  },
};
