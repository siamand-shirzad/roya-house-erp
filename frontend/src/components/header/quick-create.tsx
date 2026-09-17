import { useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Contact, HandCoins, PackagePlus, Plus } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { DocumentTypeIcon } from "@/lib/icons";
import { can, type Module } from "@/lib/permissions";
import type { DocumentType } from "@/types";

const DOCS: { type: DocumentType; label: string }[] = [
  { type: "PROFORMA", label: "پیش‌فاکتور" },
  { type: "INVOICE", label: "فاکتور فروش" },
  { type: "GOODS_ISSUE", label: "حواله خروج" },
];

export function QuickCreate({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const docs = DOCS.filter((document) => can(user, document.type.toLowerCase() as Module, true));
  const others = [
    can(user, "payments", true) && { to: "/payments?new=1", label: "دریافت وجه", icon: <HandCoins /> },
    can(user, "inventory", true) && { to: "/inventory?receipt=1", label: "ورود کالا به انبار", icon: <PackagePlus /> },
    can(user, "customers", true) && { to: "/customers?new=1", label: "طرف حساب جدید", icon: <Contact /> },
  ].filter((item): item is { to: string; label: string; icon: ReactElement } => Boolean(item));
  if (!docs.length && !others.length) return null;

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size={compact ? "icon" : "sm"} className={compact ? "size-8" : undefined} aria-label="ایجاد سریع">
          <Plus /> {!compact && "ایجاد"}
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>ایجاد سریع</DialogTitle>
          <DialogDescription>نوع موردی را که می‌خواهید ایجاد کنید انتخاب کنید.</DialogDescription>
        </DialogHeader>
        <Command className="rounded-none">
          <CommandInput autoFocus placeholder="چه چیزی می‌خواهید ایجاد کنید؟" />
          <CommandList className="max-h-[min(420px,65svh)] p-2">
            {docs.length > 0 && (
              <CommandGroup heading="سند جدید">
                {docs.map((document) => (
                  <CommandItem key={document.type} value={document.label} onSelect={() => go(`/documents/${TYPE_TO_SLUG[document.type]}/new`)} className="min-h-11 cursor-pointer">
                    <DocumentTypeIcon type={document.type} /> {document.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {docs.length > 0 && others.length > 0 && <CommandSeparator />}
            {others.length > 0 && (
              <CommandGroup heading="ثبت جدید">
                {others.map((item) => (
                  <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)} className="min-h-11 cursor-pointer">
                    {item.icon} {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
