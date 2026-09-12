import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Ban, Loader2, Lock, Save, Stamp } from "lucide-react";
import { DocumentTypeIcon } from "@/lib/icons";
import { ItemsEditor } from "@/components/documents/ItemsEditor";
import { DocumentPrint } from "@/components/documents/DocumentPrint";
import { ExportPdfButton } from "@/components/documents/ExportPdfButton";
import { PrintPreview } from "@/components/documents/PrintPreview";
import { useAuth } from "@/components/auth-provider";
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
  type Document,
  type DocumentItem,
  type DocumentType,
} from "@/types";
import { api, ApiError } from "@/lib/api";
import { toDisplayDigits, formatJalaliDate } from "@/lib/format";

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
  const [goodsIssue, setGoodsIssue] = useState<GoodsIssueFormState>(EMPTY_GOODS_ISSUE);
  const [notes, setNotes] = useState("");
  const [savedDoc, setSavedDoc] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api.documents
      .get(id)
      .then((doc) => {
        setSavedDoc(doc);
        setItems(doc.items);
        setBuyer({
          buyerName: doc.buyerName ?? "",
          buyerNationalId: doc.buyerNationalId ?? "",
          buyerEconomicCode: doc.buyerEconomicCode ?? "",
          buyerProvince: doc.buyerProvince ?? "",
          buyerCity: doc.buyerCity ?? "",
          buyerAddress: doc.buyerAddress ?? "",
          buyerPostalCode: doc.buyerPostalCode ?? "",
          buyerPhone: doc.buyerPhone ?? "",
        });
        setGoodsIssue({
          relatedInvoiceNo: doc.relatedInvoiceNo ?? "",
          deliveredToName: doc.deliveredToName ?? "",
          deliveredToNationalId: doc.deliveredToNationalId ?? "",
          vehicleColor: doc.vehicleColor ?? "",
          vehiclePlate: doc.vehiclePlate ?? "",
        });
        setNotes(doc.notes ?? "");
      })
      .catch((err: Error) => setError(`بارگذاری سند ناموفق بود: ${err.message}`))
      .finally(() => setLoading(false));
  }, [id]);

  if (!type) {
    return <div className="p-8 text-center text-muted-foreground">نوع سند نامعتبر است.</div>;
  }

  const canWrite = user ? DOCUMENT_WRITE_ROLES[type].includes(user.role) : false;
  const isDraft = !savedDoc || savedDoc.status === "DRAFT";
  const isIssued = savedDoc?.status === "ISSUED";
  const locked = !isDraft; // issued/cancelled documents are read-only from here on
  const editable = canWrite && isDraft;

  const previewDoc: Document = savedDoc
    ? {
        ...savedDoc,
        items,
        buyerName: buyer.buyerName,
        buyerNationalId: buyer.buyerNationalId,
        buyerEconomicCode: buyer.buyerEconomicCode,
        buyerProvince: buyer.buyerProvince,
        buyerCity: buyer.buyerCity,
        buyerAddress: buyer.buyerAddress,
        buyerPostalCode: buyer.buyerPostalCode,
        buyerPhone: buyer.buyerPhone,
        relatedInvoiceNo: goodsIssue.relatedInvoiceNo,
        deliveredToName: goodsIssue.deliveredToName,
        deliveredToNationalId: goodsIssue.deliveredToNationalId,
        vehicleColor: goodsIssue.vehicleColor,
        vehiclePlate: goodsIssue.vehiclePlate,
        notes,
      }
    : {
        id: "draft",
        type,
        number: 0,
        status: "DRAFT",
        issueDate: new Date().toISOString(),
        company: { id: "", name: "رویا هاوس", legalName: null, nationalId: null, economicCode: null, registration: null, province: "تهران", city: "تهران", address: "تهران، چهاردانگه به آزادگان شرق، خیابان غفاری، خیابان عرفان، عرفان یکم غربی، پلاک 105", postalCode: null, phone: "09357205000 / 09356115000", fax: null, logoUrl: null },
        customer: null,
        buyerName: buyer.buyerName,
        buyerNationalId: buyer.buyerNationalId,
        buyerEconomicCode: buyer.buyerEconomicCode,
        buyerProvince: buyer.buyerProvince,
        buyerCity: buyer.buyerCity,
        buyerAddress: buyer.buyerAddress,
        buyerPostalCode: buyer.buyerPostalCode,
        buyerPhone: buyer.buyerPhone,
        relatedInvoiceNo: goodsIssue.relatedInvoiceNo,
        vehiclePlate: goodsIssue.vehiclePlate,
        vehicleColor: goodsIssue.vehicleColor,
        deliveredToName: goodsIssue.deliveredToName,
        deliveredToNationalId: goodsIssue.deliveredToNationalId,
        notes,
        items,
        totals: { subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 },
      };

  async function handleSave() {
    if (items.length === 0) return;
    const invalidRow = items.findIndex((it) => !it.name.trim() || !it.unit.trim() || !(it.quantity > 0));
    if (invalidRow !== -1) {
      setError(`ردیف ${invalidRow + 1}: نام کالا، واحد و تعداد (بیشتر از صفر) الزامی است.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
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
        ...buyer,
        ...(typeNeedsGoodsIssueFields(type) ? goodsIssue : {}),
        notes,
      };

      const doc = savedDoc
        ? await api.documents.update(savedDoc.id, payload)
        : await api.documents.create(payload);

      setSavedDoc(doc);
      if (!id) navigate(`/documents/${typeSlug}/${doc.id}`, { replace: true });
    } catch (err) {
      setError(`ذخیره سند ناموفق بود: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleIssue() {
    if (!savedDoc) return;
    setError(null);
    setBusyAction("issue");
    try {
      setSavedDoc(await api.documents.issue(savedDoc.id));
    } catch (err) {
      setError(`صدور سند ناموفق بود: ${(err as Error).message}`);
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
    } catch (err) {
      const message =
        err instanceof ApiError && (err as any).message?.includes("Cancel the documents")
          ? "ابتدا سندهایی که از این سند ساخته شده‌اند را باطل کنید."
          : (err as Error).message;
      setError(`ابطال سند ناموفق بود: ${message}`);
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
      if ((doc as any).existing) {
        const existing = (doc as any).existing;
        navigate(`/documents/${TYPE_TO_SLUG[existing.type as DocumentType]}/${existing.id}`);
        return;
      }
      navigate(`/documents/${TYPE_TO_SLUG[to]}/${doc.id}`);
    } catch (err) {
      setError(`تبدیل سند ناموفق بود: ${(err as Error).message}`);
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="animate-spin" /> در حال بارگذاری...
      </div>
    );
  }

  const printElementId = "document-print-area";
  const nextType = NEXT_DOCUMENT_TYPE[type];
  const activeDerived = savedDoc?.derived?.find((d) => d.status !== "CANCELLED" && d.type === nextType);
  const canConvert = nextType && user && DOCUMENT_WRITE_ROLES[nextType].includes(user.role);

  return (
    <div className="space-y-8 p-4 md:p-6">
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

        <Card>
          <CardHeader>
            <CardTitle>{DOCUMENT_TYPE_LABELS[type].title} — مشخصات خریدار</CardTitle>
          </CardHeader>
          <CardContent>
            <BuyerForm value={buyer} onChange={setBuyer} disabled={!editable} />
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
            <ItemsEditor type={type} items={items} onChange={setItems} disabled={!editable} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Button onClick={handleSave} disabled={saving || items.length === 0}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {savedDoc ? "ذخیره تغییرات" : "ثبت سند"}
            </Button>
          )}

          {editable && savedDoc?.status === "DRAFT" && (
            <Button variant="outline" onClick={handleIssue} disabled={busyAction !== null || items.length === 0}>
              {busyAction === "issue" ? <Loader2 className="animate-spin" /> : <Stamp />}
              صدور سند
            </Button>
          )}

          {canWrite && isIssued && !confirmingCancel && (
            <Button variant="outline" onClick={() => setConfirmingCancel(true)} disabled={busyAction !== null}>
              <Ban /> ابطال سند
            </Button>
          )}

          {canWrite && isIssued && canConvert && nextType && !activeDerived && (
            <Button variant="outline" onClick={() => handleConvert(nextType)} disabled={busyAction !== null}>
              {busyAction === "convert" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <DocumentTypeIcon type={nextType} />
              )}
              تبدیل به {DOCUMENT_TYPE_LABELS[nextType].short}
            </Button>
          )}
        </div>

        {confirmingCancel && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <label htmlFor="cancel-reason" className="text-sm font-medium text-destructive">
              دلیل ابطال (اختیاری)
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleCancel} disabled={busyAction !== null}>
                {busyAction === "cancel" ? <Loader2 className="animate-spin" /> : <Ban />}
                تأیید ابطال سند
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmingCancel(false);
                  setCancelReason("");
                }}
                disabled={busyAction !== null}
              >
                انصراف
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <section className="space-y-3">
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
