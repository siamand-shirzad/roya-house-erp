import type { Customer, Document, DocumentType, Product } from "@/types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
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
  },
};
