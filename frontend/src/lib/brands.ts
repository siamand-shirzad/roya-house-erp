import type { Product } from "@/types";
export const BRANDS = { BANA: "بانا", GBOARD: "جیبرد", ROYA: "رویا", OTHER: "سایر" } as const;
export type Brand = keyof typeof BRANDS;
export function productBrand(product: Pick<Product, "name" | "code" | "brand">): Brand {
  if (product.brand && product.brand in BRANDS) return product.brand;
  const text = `${product.name} ${product.code ?? ""}`.replace(/[\s‌-]/g, "").toLowerCase();
  if (/بانا|bana/.test(text)) return "BANA";
  if (/جی?برد|gboard/.test(text)) return "GBOARD";
  if (/رویا|roya/.test(text)) return "ROYA";
  return "OTHER";
}
