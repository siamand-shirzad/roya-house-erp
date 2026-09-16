import { useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function useTableColumns(key: string, defaults: string[]) {
  const [hidden, setHidden] = useState<string[]>(() => {
    try { const value = JSON.parse(localStorage.getItem(key) ?? "null"); return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : defaults; }
    catch { return defaults; }
  });
  return { visible: (id: string) => !hidden.includes(id), toggle: (id: string) => setHidden((current) => {
    const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Private browsing still supports this session. */ }
    return next;
  }) };
}

export function TableColumns({ columns, visible, toggle }: { columns: { id: string; label: string }[]; visible: (id: string) => boolean; toggle: (id: string) => void }) {
  return <DropdownMenu dir="rtl">
    <DropdownMenuTrigger asChild><Button variant="outline"><Columns3 /> نمایش ستون‌ها</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>ستون‌های قابل نمایش</DropdownMenuLabel><DropdownMenuSeparator />
      {columns.map((column) => <DropdownMenuCheckboxItem key={column.id} checked={visible(column.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => toggle(column.id)}>{column.label}</DropdownMenuCheckboxItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
