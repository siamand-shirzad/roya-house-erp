import type { DocumentType } from "@/types";

export const SLUG_TO_TYPE: Record<string, DocumentType> = {
  proforma: "PROFORMA",
  invoice: "INVOICE",
  "goods-issue": "GOODS_ISSUE",
};

export const TYPE_TO_SLUG: Record<DocumentType, string> = {
  PROFORMA: "proforma",
  INVOICE: "invoice",
  GOODS_ISSUE: "goods-issue",
};
