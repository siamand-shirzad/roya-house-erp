import { Link } from "react-router-dom";

import { DocumentTypeIcon } from "@/lib/icons";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/types";

const TABS: { type: DocumentType; label: string }[] = [
  { type: "PROFORMA", label: "پیش‌فاکتور" },
  { type: "INVOICE", label: "فاکتور" },
  { type: "GOODS_ISSUE", label: "حواله خروج" },
];

// The three document types as tabs over one "اسناد" section. They are links,
// not local state, so each tab keeps its own URL (bookmarks, back button,
// dashboard cards pointing straight at invoices).
export function DocumentTypeTabs({ active }: { active: DocumentType }) {
  return (
    <nav aria-label="نوع سند" className="inline-flex rounded-lg bg-muted p-1">
      {TABS.map((tab) => {
        const selected = tab.type === active;
        return (
          <Link
            key={tab.type}
            to={`/documents/${TYPE_TO_SLUG[tab.type]}`}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <DocumentTypeIcon type={tab.type} className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
