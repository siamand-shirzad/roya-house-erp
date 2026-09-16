import { can, type Module } from "@/lib/permissions";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { matchesSearch } from "@/lib/search";
import { LoaderCircle, Plus, Search, Trash, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { CustomerDataTable } from "@/components/customers/CustomerDataTable";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { toDisplayDigits } from "@/lib/format";
import { type Customer } from "@/types";

// Customers are shared address-book entries. A document copies them into its
// own buyer_* columns when it is created, so editing one here never rewrites
// a document that was already printed.

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const setQ = (value: string) => setParams(value ? { q: value } : {}, { replace: true });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSell = user ? can(user, "proforma", true) : false;
  // Same roles as the API's DELETE /customers/:id.
  const canDelete = can(user, "customers", true);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.customers.remove(deleting.id);
      setCustomers((list) => list.filter((c) => c.id !== deleting.id));
      toast.success(`«${deleting.name}» حذف شد.`);
    } catch (err) {
      toast.error("حذف مشتری ناموفق بود.", { description: errorMessage(err) });
    } finally {
      setDeleting(null);
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    api.customers
      .list()
      .then(setCustomers)
      .catch((err) => setError(`دریافت فهرست مشتریان ناموفق بود: ${errorMessage(err)}`))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    return customers.filter((c) =>
      matchesSearch([c.name, c.customerCode, c.phone, c.city, c.nationalId].filter(Boolean).join(" "), q)
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
        <Button size="sm" onClick={openCreate} disabled={loading || !canDelete}>
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

        <CustomerDataTable
          rows={rows}
          loading={loading}
          totalCustomers={customers.length}
          canEdit={canDelete}
          canSell={canSell}
          canInvoice={Boolean(user && can(user, "invoice", true))}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={setDeleting}
          onOpenDocuments={(customer) => navigate(`/documents/invoice?customer=${customer.id}`)}
          onCreateDocument={(customer, type) => navigate(`/documents/${type === "INVOICE" ? "invoice" : "proforma"}/new?customer=${customer.id}`)}
        />

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> در حال بارگذاری...
          </p>
        )}
      </div>

      <CustomerFormDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        customer={editing}
        onSaved={onSaved}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>«{deleting?.name}» حذف شود؟</AlertDialogTitle>
            <AlertDialogDescription>
              فقط مشتری‌ای که هیچ سندی برایش ثبت نشده قابل حذف است. این کار برگشت‌پذیر نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleteBusy ? <LoaderCircle className="animate-spin" /> : <Trash />}
              حذف مشتری
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
