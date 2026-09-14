import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Ban, ChevronDown, LoaderCircle, Lock, Save, Stamp, TriangleAlert, UserPlus, X } from "lucide-react";
import { DocumentTypeIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ItemsEditor } from "@/components/documents/ItemsEditor";
import { DocumentPrint } from "@/components/documents/DocumentPrint";
import { ExportPdfButton } from "@/components/documents/ExportPdfButton";
import { PrintPreview } from "@/components/documents/PrintPreview";
import { useAuth } from "@/components/auth-provider";
import { CustomerPicker } from "@/components/documents/CustomerPicker";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import {
  BuyerForm,
  GoodsIssueForm,
  typeNeedsGoodsIssueFields,
  type BuyerFormState,
  type GoodsIssueFormState,
} from "@/components/documents/PartyForm";
import { SLUG_TO_TYPE, TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_WRITE_ROLES,
  NEXT_DOCUMENT_TYPE,
  type Company,
  type Customer,
  type Document,
  type DocumentItem,
  type DocumentLink,
  type DocumentType,
  type StockWarning,
} from "@/types";
import { toast } from "sonner";
import { api, ApiError, errorMessage } from "@/lib/api";
import { toDisplayDigits, formatJalaliDate, formatNumber } from "@/lib/format";

const EMPTY_BUYER: BuyerFormState = {
  buyerName: "",
  buyerNationalId: "",
  buyerEconomicCode: "",
  buyerProvince: "",
  buyerCity: "",
  buyerAddress: "",
  buyerPostalCode: "",
  buyerPhone: "",
};

const EMPTY_GOODS_ISSUE: GoodsIssueFormState = {
  relatedInvoiceNo: "",
  deliveredToName: "",
  deliveredToNationalId: "",
  vehicleColor: "",
  vehiclePlate: "",
};

const STATUS_BADGE: Record<Document["status"], { label: string; className: string }> = {
  DRAFT: { label: "پیش‌نویس", className: "border-border bg-muted text-muted-foreground" },
  ISSUED: {
    label: "صادر شده",
    className:
      "border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  CANCELLED: {
    label: "باطل شده",
    className:
      "border-red-600/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
  },
};

const buyerFromDoc = (doc: Document): BuyerFormState => ({
  buyerName: doc.buyerName ?? "",
  buyerNationalId: doc.buyerNationalId ?? "",
  buyerEconomicCode: doc.buyerEconomicCode ?? "",
  buyerProvince: doc.buyerProvince ?? "",
  buyerCity: doc.buyerCity ?? "",
  buyerAddress: doc.buyerAddress ?? "",
  buyerPostalCode: doc.buyerPostalCode ?? "",
  buyerPhone: doc.buyerPhone ?? "",
});

const goodsIssueFromDoc = (doc: Document): GoodsIssueFormState => ({
  relatedInvoiceNo: doc.relatedInvoiceNo ?? "",
  deliveredToName: doc.deliveredToName ?? "",
  deliveredToNationalId: doc.deliveredToNationalId ?? "",
  vehicleColor: doc.vehicleColor ?? "",
  vehiclePlate: doc.vehiclePlate ?? "",
});

// What gets sent on save. Also serialized to tell whether the form differs
// from what the server has (so "issue" never issues a stale version).
function buildPayload(
  type: DocumentType,
  items: DocumentItem[],
  customerId: string | null,
  buyer: BuyerFormState,
  goodsIssue: GoodsIssueFormState,
  notes: string
) {
  return {
    type,
    items: items.map((it) => ({
      productId: it.productId ?? undefined,
      name: it.name,
      spec: it.spec ?? undefined,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount ?? 0,
      taxRate: it.taxRate ?? 0,
    })),
    customerId,
    ...buyer,
    ...(typeNeedsGoodsIssueFields(type) ? goodsIssue : {}),
    notes,
  };
}

/** Products on the form whose total quantity is more than the stock on hand. */
function shortfallsFor(items: DocumentItem[], stock: Map<string, number>): StockWarning[] {
  const requested = new Map<string, StockWarning>();
  for (const it of items) {
    if (!it.productId) continue;
    const row = requested.get(it.productId);
    if (row) row.requested += it.quantity;
    else
      requested.set(it.productId, {
        productId: it.productId,
        name: it.name,
        unit: it.unit,
        requested: it.quantity,
        available: stock.get(it.productId) ?? 0,
      });
  }
  return [...requested.values()].filter((r) => r.requested > r.available);
}

const toStockMap = (rows: { productId: string; onHand: number }[]) =>
  new Map(rows.map((r) => [r.productId, r.onHand]));

export function DocumentFormPage() {
  const { typeSlug, id } = useParams<{ typeSlug: string; id?: string }>();
  const navigate = useNavigate();
  const type = SLUG_TO_TYPE[typeSlug ?? ""];
  const { user } = useAuth();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<"issue" | "cancel" | "convert" | null>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [buyer, setBuyer] = useState<BuyerFormState>(EMPTY_BUYER);
  // The buyer fields are the document's own copy; customerId only records who
  // they were taken from, so the customer list can be kept in sync later.
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [saveCustomerOpen, setSaveCustomerOpen] = useState(false);
  // The buyer card folds to a one-line summary once a buyer is filled in, so
  // the items table isn't pushed below the fold.
  const [buyerOpen, setBuyerOpen] = useState(true);
  const [goodsIssue, setGoodsIssue] = useState<GoodsIssueFormState>(EMPTY_GOODS_ISSUE);
  const [notes, setNotes] = useState("");
  const [savedDoc, setSavedDoc] = useState<Document | null>(null);
  // JSON of the payload the server last confirmed; compared to detect unsaved edits.
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Seller block for the preview of a document that hasn't been saved yet.
  const [company, setCompany] = useState<Company | null>(null);
  // Goods issues only: stock on hand per product, and the shortfalls awaiting confirmation.
  const [stock, setStock] = useState<Map<string, number> | null>(null);
  const [shortages, setShortages] = useState<StockWarning[] | null>(null);

  // "New document for this customer" (customers page) arrives as ?customer=<id>.
  const [searchParams] = useSearchParams();
  const presetCustomerId = id ? null : searchParams.get("customer");
  useEffect(() => {
    if (!presetCustomerId) return;
    api.customers
      .get(presetCustomerId)
      .then(applyCustomer)
      .catch(() => undefined);
  }, [presetCustomerId]);

  useEffect(() => {
    if (id) return;
    api.company
      .get()
      .then(setCompany)
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (type !== "GOODS_ISSUE") return;
    api.inventory
      .stock()
      .then((rows) => setStock(toStockMap(rows)))
      .catch(() => setStock(null));
  }, [type]);

  useEffect(() => {
    if (!id || !type) return;
    setLoading(true);
    setError(null);
    api.documents
      .get(id)
      .then((doc) => {
        const loadedBuyer = buyerFromDoc(doc);
        const loadedGoodsIssue = goodsIssueFromDoc(doc);
        setSavedDoc(doc);
        setItems(doc.items);
        setCustomerId(doc.customer?.id ?? null);
        setCustomerName(doc.customer?.name ?? null);
        setBuyerOpen(!doc.buyerName);
        setBuyer(loadedBuyer);
        setGoodsIssue(loadedGoodsIssue);
        setNotes(doc.notes ?? "");
        setSavedSnapshot(
          JSON.stringify(
            buildPayload(type, doc.items, doc.customer?.id ?? null, loadedBuyer, loadedGoodsIssue, doc.notes ?? "")
          )
        );
      })
      .catch((err) => setError(`بارگذاری سند ناموفق بود: ${errorMessage(err)}`))
      .finally(() => setLoading(false));
  }, [id, type]);

  // Warn before closing the tab or reloading with edits that aren't saved.
  const unsavedRef = useRef(false);
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (!type) {
    return <div className="p-8 text-center text-muted-foreground">نوع سند نامعتبر است.</div>;
  }

  const canWrite = user ? DOCUMENT_WRITE_ROLES[type].includes(user.role) : false;
  const isDraft = !savedDoc || savedDoc.status === "DRAFT";
  const isIssued = savedDoc?.status === "ISSUED";
  const locked = !isDraft; // issued/cancelled documents are read-only from here on
  const editable = canWrite && isDraft;

  const payload = buildPayload(type, items, customerId, buyer, goodsIssue, notes);
  const dirty = editable && (savedDoc ? JSON.stringify(payload) !== savedSnapshot : items.length > 0);
  unsavedRef.current = dirty && !loading;

  const previewDoc: Document = savedDoc
    ? {
        ...savedDoc,
        items,
        ...buyer,
        ...goodsIssue,
        notes,
      }
    : {
        id: "draft",
        type,
        number: 0,
        status: "DRAFT",
        issueDate: new Date().toISOString(),
        company,
        customer: null,
        ...buyer,
        ...goodsIssue,
        notes,
        items,
        totals: { subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 },
      };

  function applyCustomer(customer: Customer) {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setBuyerOpen(false);
    setBuyer({
      buyerName: customer.name,
      buyerNationalId: customer.nationalId ?? "",
      buyerEconomicCode: customer.economicCode ?? "",
      buyerProvince: customer.province ?? "",
      buyerCity: customer.city ?? "",
      buyerAddress: customer.address ?? "",
      buyerPostalCode: customer.postalCode ?? "",
      buyerPhone: customer.phone ?? "",
    });
  }

  /** Saves the form; returns the saved document, or null (with the error shown). */
  async function saveDocument(): Promise<Document | null> {
    if (items.length === 0) return null;
    const invalidRow = items.findIndex((it) => !it.name.trim() || !it.unit.trim() || !(it.quantity > 0));
    if (invalidRow !== -1) {
      setError(`ردیف ${toDisplayDigits(invalidRow + 1)}: نام کالا، واحد و تعداد (بیشتر از صفر) الزامی است.`);
      return null;
    }
    setError(null);
    setSaving(true);
    try {
      const doc = savedDoc
        ? await api.documents.update(savedDoc.id, payload)
        : await api.documents.create(payload);
      setSavedDoc(doc);
      setSavedSnapshot(JSON.stringify(payload));
      if (!id) {
        // The new URL remounts this page; don't let the unsaved-changes guard fire.
        unsavedRef.current = false;
        navigate(`/documents/${typeSlug}/${doc.id}`, { replace: true });
      }
      return doc;
    } catch (err) {
      setError(`ذخیره سند ناموفق بود: ${errorMessage(err)}`);
      return null;
    } finally {
      setSaving(false);
    }
  }

  // Issue button: for a goods issue, check stock first and ask before booking
  // more than is on hand (stock may go negative, but not silently).
  async function requestIssue() {
    if (!savedDoc) return;
    if (type === "GOODS_ISSUE") {
      setBusyAction("issue");
      try {
        const fresh = toStockMap(await api.inventory.stock());
        setStock(fresh);
        const short = shortfallsFor(items, fresh);
        if (short.length) {
          setShortages(short);
          setBusyAction(null);
          return;
        }
      } catch {
        // Stock couldn't be read; issue anyway, the server still reports shortfalls.
      }
    }
    await handleIssue();
  }

  async function handleIssue() {
    if (!savedDoc) return;
    setError(null);
    setBusyAction("issue");
    try {
      // Issue exactly what is on screen: save pending edits first.
      if (dirty && !(await saveDocument())) return;
      const { stockWarnings, ...issued } = await api.documents.issue(savedDoc.id);
      setSavedDoc(issued);
      setShortages(null);
      if (stockWarnings?.length) {
        toast.warning(`موجودی ${toDisplayDigits(stockWarnings.length)} کالا منفی شد.`, {
          description: stockWarnings.map((w) => w.name).join("، "),
        });
      } else if (type === "GOODS_ISSUE") {
        toast.success("حواله صادر شد و از موجودی انبار کسر شد.");
      }
    } catch (err) {
      setShortages(null);
      setError(`صدور سند ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCancel() {
    if (!savedDoc) return;
    setError(null);
    setBusyAction("cancel");
    try {
      setSavedDoc(await api.documents.cancel(savedDoc.id, cancelReason.trim() || undefined));
      setConfirmingCancel(false);
      setCancelReason("");
      if (type === "GOODS_ISSUE") toast.success("حواله باطل شد و کالاها به موجودی برگشت.");
    } catch (err) {
      // Close the dialog first, or the reason it failed renders behind it.
      setConfirmingCancel(false);
      setError(`ابطال سند ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConvert(to: DocumentType) {
    if (!savedDoc) return;
    setError(null);
    setBusyAction("convert");
    try {
      const doc = await api.documents.convert(savedDoc.id, to);
      navigate(`/documents/${TYPE_TO_SLUG[to]}/${doc.id}`);
    } catch (err) {
      // Already converted: open the document that exists instead of failing.
      const existing = err instanceof ApiError && err.status === 409 ? (err.body.existing as DocumentLink) : null;
      if (existing) {
        navigate(`/documents/${TYPE_TO_SLUG[existing.type]}/${existing.id}`);
        return;
      }
      setError(`تبدیل سند ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <LoaderCircle className="animate-spin" /> در حال بارگذاری...
      </div>
    );
  }

  const printElementId = "document-print-area";
  const nextType = NEXT_DOCUMENT_TYPE[type];
  const activeDerived = savedDoc?.derived?.find((d) => d.status !== "CANCELLED" && d.type === nextType);
  const canConvert = nextType && user && DOCUMENT_WRITE_ROLES[nextType].includes(user.role);
  const SHORTAGE_PREVIEW = 5;

  return (
    // On very wide screens the preview sits beside the editor and stays in view;
    // below that it follows the editor, as before.
    <div className="grid gap-8 p-4 md:p-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] 2xl:items-start">
      <div className="space-y-4">
        {savedDoc && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className={STATUS_BADGE[savedDoc.status].className}>
              {STATUS_BADGE[savedDoc.status].label}
            </Badge>
            <span className="text-muted-foreground">
              شماره سند: <span className="font-medium text-foreground">{toDisplayDigits(savedDoc.number)}</span>
            </span>
            {savedDoc.createdByName && (
              <span className="text-muted-foreground">ثبت‌کننده: {savedDoc.createdByName}</span>
            )}
            {savedDoc.status === "ISSUED" && savedDoc.issuedByName && savedDoc.issuedAt && (
              <span className="text-muted-foreground">
                صادرکننده: {savedDoc.issuedByName} در {formatJalaliDate(new Date(savedDoc.issuedAt))}
              </span>
            )}
            {savedDoc.status === "CANCELLED" && savedDoc.cancelledByName && (
              <span className="text-muted-foreground">
                باطل‌کننده: {savedDoc.cancelledByName}
                {savedDoc.cancelReason ? ` — دلیل: ${savedDoc.cancelReason}` : ""}
              </span>
            )}
            {savedDoc.source && (
              <Link
                to={`/documents/${TYPE_TO_SLUG[savedDoc.source.type]}/${savedDoc.source.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                ساخته‌شده از {DOCUMENT_TYPE_LABELS[savedDoc.source.type].short} شماره{" "}
                {toDisplayDigits(savedDoc.source.number)}
              </Link>
            )}
            {savedDoc.derived
              ?.filter((d) => d.status !== "CANCELLED")
              .map((d) => (
                <Link
                  key={d.id}
                  to={`/documents/${TYPE_TO_SLUG[d.type]}/${d.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {DOCUMENT_TYPE_LABELS[d.type].short} شماره {toDisplayDigits(d.number)} از این سند ساخته شده
                </Link>
              ))}
          </div>
        )}

        {locked && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>
              این سند {savedDoc?.status === "CANCELLED" ? "باطل شده" : "صادر شده"} و دیگر قابل ویرایش نیست.
              {savedDoc?.status === "ISSUED" && " برای اصلاح، آن را باطل و سند جدید ثبت کنید."}
            </p>
          </div>
        )}
        {!locked && !canWrite && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>شما اجازه‌ی ثبت یا ویرایش {DOCUMENT_TYPE_LABELS[type].title} را ندارید.</p>
          </div>
        )}

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">مشخصات خریدار</CardTitle>
            {!buyerOpen && (
              <CardDescription className="truncate">
                {[buyer.buyerName || "بدون نام", buyer.buyerPhone, buyer.buyerCity].filter(Boolean).join(" · ")}
              </CardDescription>
            )}
            <CardAction>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBuyerOpen((o) => !o)}
                aria-expanded={buyerOpen}
              >
                {buyerOpen ? "بستن" : editable ? "ویرایش" : "جزئیات"}
                <ChevronDown className={cn("transition-transform duration-200", buyerOpen && "rotate-180")} />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            {editable && (
              <div className="flex flex-wrap items-center gap-2">
                <CustomerPicker onSelect={applyCustomer} />
                {customerId ? (
                  <Badge variant="outline" className="gap-1 py-1">
                    از مشتری: {customerName ?? buyer.buyerName}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId(null);
                        setCustomerName(null);
                      }}
                      className="rounded-sm opacity-60 hover:opacity-100"
                      title="جدا کردن از مشتری"
                    >
                      <X className="size-3.5" />
                      <span className="sr-only">جدا کردن از مشتری</span>
                    </button>
                  </Badge>
                ) : (
                  buyer.buyerName.trim() !== "" && (
                    <Button variant="ghost" size="sm" onClick={() => setSaveCustomerOpen(true)}>
                      <UserPlus /> ثبت در فهرست مشتریان
                    </Button>
                  )
                )}
              </div>
            )}
            {buyerOpen && (
              <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200">
                <BuyerForm value={buyer} onChange={setBuyer} disabled={!editable} />
              </div>
            )}
          </CardContent>
        </Card>

        {typeNeedsGoodsIssueFields(type) && (
          <Card>
            <CardHeader>
              <CardTitle>مشخصات تحویل</CardTitle>
            </CardHeader>
            <CardContent>
              <GoodsIssueForm value={goodsIssue} onChange={setGoodsIssue} disabled={!editable} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>اقلام</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Stock is only meaningful before issuing; afterwards this document is already deducted. */}
            <ItemsEditor
              type={type}
              items={items}
              onChange={setItems}
              disabled={!editable}
              stock={isDraft ? (stock ?? undefined) : undefined}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Button onClick={saveDocument} disabled={saving || items.length === 0 || (!!savedDoc && !dirty)}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              {savedDoc ? "ذخیره تغییرات" : "ثبت سند"}
            </Button>
          )}

          {editable && savedDoc?.status === "DRAFT" && (
            <Button
              variant="outline"
              onClick={requestIssue}
              disabled={busyAction !== null || saving || items.length === 0}
            >
              {busyAction === "issue" ? <LoaderCircle className="animate-spin" /> : <Stamp />}
              {dirty ? "ذخیره و صدور سند" : "صدور سند"}
            </Button>
          )}

          {canWrite && isIssued && (
            <Button variant="outline" onClick={() => setConfirmingCancel(true)} disabled={busyAction !== null}>
              <Ban /> ابطال سند
            </Button>
          )}

          {canWrite && isIssued && canConvert && nextType && !activeDerived && (
            <Button variant="outline" onClick={() => handleConvert(nextType)} disabled={busyAction !== null}>
              {busyAction === "convert" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <DocumentTypeIcon type={nextType} />
              )}
              تبدیل به {DOCUMENT_TYPE_LABELS[nextType].short}
            </Button>
          )}

          {dirty && savedDoc && !saving && (
            <span className="text-sm text-muted-foreground">تغییرات ذخیره نشده</span>
          )}
        </div>

        <CustomerFormDialog
          open={saveCustomerOpen}
          onOpenChange={setSaveCustomerOpen}
          customer={null}
          draft={{
            name: buyer.buyerName,
            nationalId: buyer.buyerNationalId || null,
            economicCode: buyer.buyerEconomicCode || null,
            province: buyer.buyerProvince || null,
            city: buyer.buyerCity || null,
            address: buyer.buyerAddress || null,
            postalCode: buyer.buyerPostalCode || null,
            phone: buyer.buyerPhone || null,
          }}
          onSaved={(customer) => {
            applyCustomer(customer);
            toast.success(`«${customer.name}» به فهرست مشتریان اضافه شد.`);
          }}
        />

        <AlertDialog
          open={shortages !== null}
          onOpenChange={(open) => {
            if (!open && busyAction !== "issue") setShortages(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>موجودی انبار کافی نیست</AlertDialogTitle>
              <AlertDialogDescription>
                با صدور این حواله، موجودی کالاهای زیر منفی می‌شود. اگر کالا واقعاً تحویل شده، صادر کنید و بعد
                ورود کالا یا اصلاح موجودی را ثبت کنید.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="divide-y rounded-md border text-sm">
              {shortages?.slice(0, SHORTAGE_PREVIEW).map((s) => (
                <li key={s.productId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    موجودی {formatNumber(s.available)} · درخواست{" "}
                    <span className="font-medium text-destructive">{formatNumber(s.requested)}</span> {s.unit}
                  </span>
                </li>
              ))}
              {shortages && shortages.length > SHORTAGE_PREVIEW && (
                <li className="px-3 py-2 text-muted-foreground">
                  و {toDisplayDigits(shortages.length - SHORTAGE_PREVIEW)} مورد دیگر
                </li>
              )}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busyAction === "issue"}>انصراف</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleIssue();
                }}
                disabled={busyAction !== null}
              >
                {busyAction === "issue" ? <LoaderCircle className="animate-spin" /> : <Stamp />}
                صدور با این حال
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={confirmingCancel}
          onOpenChange={(open) => {
            if (busyAction === "cancel") return;
            setConfirmingCancel(open);
            if (!open) setCancelReason("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>این سند باطل شود؟</AlertDialogTitle>
              <AlertDialogDescription>
                سند صادرشده حذف نمی‌شود؛ باطل می‌ماند و شماره‌اش دیگر استفاده نمی‌شود. این کار
                برگشت‌پذیر نیست.
                {type === "GOODS_ISSUE" && " کالاهای این حواله به موجودی انبار برمی‌گردند."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2 text-start">
              <Label htmlFor="cancel-reason">دلیل ابطال (اختیاری)</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busyAction === "cancel"}>انصراف</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  handleCancel();
                }}
                disabled={busyAction !== null}
              >
                {busyAction === "cancel" ? <LoaderCircle className="animate-spin" /> : <Ban />}
                تأیید ابطال سند
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <section className="space-y-3 2xl:sticky 2xl:top-[calc(var(--header-height)+1.5rem)] 2xl:max-h-[calc(100svh-var(--header-height)-3rem)] 2xl:overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">پیش‌نمایش سند</h3>
          <ExportPdfButton
            elementId={printElementId}
            fileName={`${TYPE_TO_SLUG[type]}-${savedDoc?.number ?? "draft"}.pdf`}
          />
        </div>
        <Separator />
        {/* The sheet itself is always "paper" white; only the backdrop follows the theme. */}
        <div className="rounded-xl border bg-muted/60 p-3 sm:p-6 dark:bg-neutral-950/60">
          <PrintPreview>
            <DocumentPrint doc={previewDoc} elementId={printElementId} />
          </PrintPreview>
        </div>
      </section>
    </div>
  );
}
