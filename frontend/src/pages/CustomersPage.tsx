import { useEffect, useMemo, useState } from "react";
import { Contact, LoaderCircle, Pencil, Plus, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { CustomerFormSheet } from "@/components/customers/CustomerFormSheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { toDisplayDigits } from "@/lib/format";
import type { Customer } from "@/types";

// Customers are shared address-book entries. A document copies them into its
// own buyer_* columns when it is created, so editing one here never rewrites
// a document that was already printed.

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  useEffect(() => {
    api.customers
      .list()
      .then(setCustomers)
      .catch((err) => setError(`دریافت فهرست مشتریان ناموفق بود: ${errorMessage(err)}`))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) =>
      [c.name, c.customerCode, c.phone, c.city, c.nationalId]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle))
    );
  }, [customers, q]);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setSheetOpen(true);
  }

  function onSaved(saved: Customer, mode: "created" | "updated") {
    setCustomers((list) =>
      mode === "created"
        ? [...list, saved].sort((a, b) => a.name.localeCompare(b.name, "fa"))
        : list.map((c) => (c.id === saved.id ? saved : c))
    );
    toast.success(mode === "created" ? `«${saved.name}» به فهرست مشتریان اضافه شد.` : `«${saved.name}» ذخیره شد.`);
  }

  return (
    <AppShell
      title="مشتریان"
      actions={
        <Button size="sm" onClick={openCreate} disabled={loading}>
          <Plus /> مشتری جدید
        </Button>
      }
    >
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 right-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="جستجو در نام، کد، تلفن یا شهر..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pr-8"
            />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums sm:ms-auto">
            {toDisplayDigits(rows.length)} مشتری
          </span>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2.5 text-right font-medium">نام مشتری</th>
                <th className="w-28 px-3 py-2.5 text-right font-medium">کد</th>
                <th className="w-36 px-3 py-2.5 text-right font-medium">تلفن</th>
                <th className="w-36 px-3 py-2.5 text-right font-medium">شهرستان</th>
                <th className="w-40 px-3 py-2.5 text-right font-medium">شناسه ملی</th>
                <th className="w-20 px-3 py-2.5 text-right font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <Skeleton className="h-4 w-full max-w-28" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-14">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <Contact className="size-6" />
                      </div>
                      {customers.length === 0 ? (
                        <>
                          <p>هنوز مشتری‌ای ثبت نشده است.</p>
                          <Button size="sm" onClick={openCreate}>
                            <Plus /> افزودن اولین مشتری
                          </Button>
                        </>
                      ) : (
                        <p>مشتری‌ای با این جستجو پیدا نشد.</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">
                      {c.name}
                      {c.address && (
                        <div className="text-xs font-normal text-muted-foreground">{c.address}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.customerCode ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums" dir="ltr">
                      <span className="block text-right">{c.phone ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2">{c.city ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{c.nationalId ?? "—"}</td>
                    <td className="px-1.5 py-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} title="ویرایش مشتری">
                        <Pencil />
                        <span className="sr-only">ویرایش {c.name}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> در حال بارگذاری...
          </p>
        )}
      </div>

      <CustomerFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customer={editing}
        onSaved={onSaved}
      />
    </AppShell>
  );
}
