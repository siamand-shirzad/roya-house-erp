import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save } from "lucide-react";
import { ItemsEditor } from "@/components/documents/ItemsEditor";
import { DocumentPrint } from "@/components/documents/DocumentPrint";
import { ExportPdfButton } from "@/components/documents/ExportPdfButton";
import { PrintPreview } from "@/components/documents/PrintPreview";
import {
  BuyerForm,
  GoodsIssueForm,
  typeNeedsGoodsIssueFields,
  type BuyerFormState,
  type GoodsIssueFormState,
} from "@/components/documents/PartyForm";
import { SLUG_TO_TYPE, TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { DOCUMENT_TYPE_LABELS, type Document, type DocumentItem } from "@/types";
import { api } from "@/lib/api";
import { toDisplayDigits } from "@/lib/format";

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

export function DocumentFormPage() {
  const { typeSlug, id } = useParams<{ typeSlug: string; id?: string }>();
  const navigate = useNavigate();
  const type = SLUG_TO_TYPE[typeSlug ?? ""];

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [buyer, setBuyer] = useState<BuyerFormState>(EMPTY_BUYER);
  const [goodsIssue, setGoodsIssue] = useState<GoodsIssueFormState>(EMPTY_GOODS_ISSUE);
  const [notes, setNotes] = useState("");
  const [savedDoc, setSavedDoc] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="animate-spin" /> در حال بارگذاری...
      </div>
    );
  }

  const printElementId = "document-print-area";

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{DOCUMENT_TYPE_LABELS[type].title} — مشخصات خریدار</CardTitle>
          </CardHeader>
          <CardContent>
            <BuyerForm value={buyer} onChange={setBuyer} />
          </CardContent>
        </Card>

        {typeNeedsGoodsIssueFields(type) && (
          <Card>
            <CardHeader>
              <CardTitle>مشخصات تحویل</CardTitle>
            </CardHeader>
            <CardContent>
              <GoodsIssueForm value={goodsIssue} onChange={setGoodsIssue} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>اقلام</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemsEditor type={type} items={items} onChange={setItems} />
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving || items.length === 0}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {savedDoc ? "ذخیره تغییرات" : "ثبت سند"}
          </Button>
          {savedDoc && (
            <span className="text-sm text-muted-foreground">
              شماره سند: {toDisplayDigits(savedDoc.number)} — وضعیت: {savedDoc.status === "DRAFT" ? "پیش‌نویس" : "صادر شده"}
            </span>
          )}
        </div>
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
