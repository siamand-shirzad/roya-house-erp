import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { Contact, HandCoins, PackagePlus, Plus } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { DocumentTypeIcon } from "@/lib/icons";
import { can, type Module } from "@/lib/permissions";
import type { DocumentType } from "@/types";

const DOCS: { type: DocumentType; label: string }[] = [
  { type: "PROFORMA", label: "پیش‌فاکتور" },
  { type: "INVOICE", label: "فاکتور فروش" },
  { type: "GOODS_ISSUE", label: "حواله خروج" },
];

// "ایجاد سریع": every "new ..." the signed-in user is allowed to start, from
// any page. The target pages open their own form from `?new=1`.
export function QuickCreate({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  if (!user) return null;
  const docs = DOCS.filter((d) => can(user, d.type.toLowerCase() as Module, true));
  const others = [
    can(user, "payments", true) && { to: "/payments?new=1", label: "دریافت وجه", icon: <HandCoins /> },
    can(user, "inventory", true) && { to: "/inventory?receipt=1", label: "ورود کالا به انبار", icon: <PackagePlus /> },
    can(user, "customers", true) && { to: "/customers?new=1", label: "طرف حساب جدید", icon: <Contact /> },
  ].filter((x): x is { to: string; label: string; icon: ReactElement } => !!x);
  if (docs.length + others.length === 0) return null;

  return (
    <DropdownMenu dir="rtl" modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? "icon" : "sm"} className={compact ? "size-8" : undefined} aria-label="ایجاد سریع">
          <Plus />
          {!compact && "ایجاد"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {docs.length > 0 && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">سند جدید</DropdownMenuLabel>}
        {docs.map((d) => (
          <DropdownMenuItem key={d.type} asChild>
            <Link to={`/documents/${TYPE_TO_SLUG[d.type]}/new`}>
              <DocumentTypeIcon type={d.type} /> {d.label}
            </Link>
          </DropdownMenuItem>
        ))}
        {docs.length > 0 && others.length > 0 && <DropdownMenuSeparator />}
        {others.map((o) => (
          <DropdownMenuItem key={o.to} asChild>
            <Link to={o.to}>
              {o.icon} {o.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
