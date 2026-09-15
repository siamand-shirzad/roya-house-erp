import { SegmentedControl } from "@/components/segmented-control";
import { DocumentTypeIcon } from "@/lib/icons";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import type { DocumentType } from "@/types";

const TABS: { type: DocumentType; label: string }[] = [
  { type: "PROFORMA", label: "پیش‌فاکتور" },
  { type: "INVOICE", label: "فاکتور" },
  { type: "GOODS_ISSUE", label: "حواله خروج" },
];

// The three document types as tabs over one "اسناد" section. They are links,
// not local state, so each tab keeps its own URL (bookmarks, back button,
// dashboard cards pointing straight at invoices). Switching tabs keeps the
// list page mounted, so the selection pill slides across.
// `search` (e.g. "?customer=<id>") is carried across tabs so a filter survives switching type.
export function DocumentTypeTabs({ active, search = "" }: { active: DocumentType; search?: string }) {
  return (
    <nav aria-label="نوع سند">
      <SegmentedControl
        ariaLabel="نوع سند"
        value={active}
        items={TABS.map((tab) => ({
          value: tab.type,
          label: tab.label,
          icon: <DocumentTypeIcon type={tab.type} />,
          href: `/documents/${TYPE_TO_SLUG[tab.type]}${search}`,
        }))}
      />
    </nav>
  );
}
