import {
  BadgeCheck,
  Bolt,
  Boxes,
  FileClock,
  Frame,
  Grid2x2,
  Layers,
  Link2,
  PaintRoller,
  ReceiptText,
  Ruler,
  Truck,
  type LucideIcon,
} from "lucide-react";

import type { DocumentType, ProductCategory } from "@/types";

// One lucide icon per document type and per product category, so the same
// thing is never drawn two different ways across the sidebar, the dashboard
// cards, the list pages and the landing page. Pick from here rather than
// choosing an icon inline at the call site.

// The three paper forms in the order they convert into each other: a
// time-limited quote, then the sales invoice, then the goods leaving the
// warehouse.
export const DOCUMENT_TYPE_ICONS: Record<DocumentType, LucideIcon> = {
  PROFORMA: FileClock,
  INVOICE: ReceiptText,
  GOODS_ISSUE: Truck,
};

// Drywall / suspended-ceiling goods. Each icon is chosen for the shape of the
// product itself: stacked boards, a metal frame, a tile grid, profiles sold by
// length, a bolt head, a finishing tool, a connection, a branded panel and a
// mixed-stock box.
export const CATEGORY_ICONS: Record<ProductCategory, LucideIcon> = {
  GYPSUM_PANEL: Layers,
  METAL_STRUCTURE: Frame,
  GYPSUM_TILE: Grid2x2,
  SPRI_ACCESSORY: Ruler,
  SCREW_BOLT: Bolt,
  TAPE_PUTTY: PaintRoller,
  CONNECTOR: Link2,
  OTHER: Boxes,
  BRAND_PANEL: BadgeCheck,
};

// Thin wrappers so call sites can render an icon straight from a value
// (`type`, `category`) without pulling the component out of the map first.
// Every icon here sits next to its own label, so they are decorative.
export function DocumentTypeIcon({
  type,
  className,
}: {
  type: DocumentType;
  className?: string;
}) {
  const Icon = DOCUMENT_TYPE_ICONS[type];
  return <Icon className={className} aria-hidden="true" />;
}

export function CategoryIcon({
  category,
  className,
}: {
  category: ProductCategory;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon className={className} aria-hidden="true" />;
}
