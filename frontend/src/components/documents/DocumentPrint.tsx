import type { Document, DocumentItem } from "@/types";
import { DOCUMENT_TYPE_LABELS } from "@/types";
import { formatJalaliDate } from "@/lib/format";
import { toDisplayDigits, formatNumber, formatToman } from "@/lib/format";
import { computeDocumentTotals, computeLineTotal } from "@/lib/totals";
import { tomanToRialWords } from "@/lib/numberToWords";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

// Visual reproduction of the three Roya House paper templates:
// PROFORMA (پیش فاکتور), INVOICE (صورتحساب فروش کالا و خدمات) and
// GOODS_ISSUE (حواله خروج از انبار کالا). This component is used both for
// the on-screen live preview and as the DOM node captured for PDF export,
// so it intentionally uses fixed pixel widths (an A4-ish 794px canvas) and
// print-safe colors instead of dark-mode aware theme tokens.

type PartyInfo = {
  name?: string | null;
  nationalId?: string | null;
  economicCode?: string | null;
  registration?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  postalCode?: string | null;
  phone?: string | null;
};

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 gap-1 border-b border-dashed border-neutral-300 py-[3px] leading-4",
        className
      )}
    >
      <span className="shrink-0 text-neutral-500">{label}:</span>
      <span className="min-w-0 font-medium text-neutral-900">{value || " "}</span>
    </div>
  );
}

function SectionHeader({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    // Brand palette on paper: warm light grey fill, red accent bar at the reading start.
    <div className="flex items-baseline justify-between gap-2 bg-[#f3f0ef] border border-[#c9c3c0] border-s-4 border-s-[#ab2c33] border-b-0 px-3 py-1 text-[12px] font-bold text-[#3a3a3c]">
      <span>{children}</span>
      {note && <span className="text-[10px] font-normal text-neutral-500">{note}</span>}
    </div>
  );
}

// Four columns rather than two: the nine party fields fit in three short rows
// instead of five, which is what buys the items table enough room for ten
// lines on a single A4 page. The two widest values (name and address) get the
// extra spans, so neither has to wrap to a second line.
function PartyBox({ title, party }: { title: string; party: PartyInfo }) {
  return (
    <div className="mb-2">
      <SectionHeader>{title}</SectionHeader>
      <div className="grid grid-cols-4 gap-x-4 border border-[#c9c3c0] px-2.5 py-1.5 text-[10.5px]">
        <Field label="نام شخص حقیقی/حقوقی" value={party.name} className="col-span-2" />
        <Field label="شناسه ملی / کد ملی" value={party.nationalId} />
        <Field label="شماره اقتصادی" value={party.economicCode} />
        <Field label="شماره ثبت" value={party.registration} />
        <Field label="استان" value={party.province} />
        <Field label="شهرستان" value={party.city} />
        <Field label="کدپستی" value={party.postalCode} />
        <Field label="شماره تلفن / نمابر" value={party.phone} />
        <Field label="آدرس" value={party.address} className="col-span-3" />
      </div>
    </div>
  );
}

// Money columns are narrow by design, so they carry half the horizontal
// padding of the text columns and never wrap a figure onto a second line.
const MONEY_CELL = "border border-[#c9c3c0] px-0.5 py-0.5 whitespace-nowrap";

function SignatureBox({ label }: { label: string }) {
  return (
    <div className="border border-[#c9c3c0] h-24 flex flex-col">
      <div className="border-b border-[#c9c3c0] bg-[#f3f0ef] text-center text-[12px] font-bold py-1.5">
        {label}
      </div>
    </div>
  );
}

export function DocumentPrint({ doc, elementId }: { doc: Document; elementId?: string }) {
  const isInvoiceLike = doc.type === "INVOICE" || doc.type === "PROFORMA";
  const meta = DOCUMENT_TYPE_LABELS[doc.type];
  const totals = computeDocumentTotals(doc.items);
  const issueDate = new Date(doc.issueDate);

  const seller: PartyInfo = {
    name: doc.company?.name,
    nationalId: doc.company?.nationalId,
    economicCode: doc.company?.economicCode,
    registration: doc.company?.registration,
    province: doc.company?.province,
    city: doc.company?.city,
    address: doc.company?.address,
    postalCode: doc.company?.postalCode,
    phone: doc.company?.phone,
  };

  const buyer: PartyInfo = {
    name: doc.buyerName || doc.customer?.name,
    nationalId: doc.buyerNationalId || doc.customer?.nationalId,
    economicCode: doc.buyerEconomicCode || doc.customer?.economicCode,
    registration: doc.customer?.registration,
    province: doc.buyerProvince || doc.customer?.province,
    city: doc.buyerCity || doc.customer?.city,
    address: doc.buyerAddress || doc.customer?.address,
    postalCode: doc.buyerPostalCode || doc.customer?.postalCode,
    phone: doc.buyerPhone || doc.customer?.phone,
  };

  return (
    <div
      id={elementId}
      dir="rtl"
      // Fixed width, never shrunk to the container: the PDF is captured from
      // this node, so its layout must not depend on the screen size.
      className="mx-auto w-[794px] shrink-0 bg-white p-8 text-neutral-900 shadow-sm"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-[#ab2c33] pb-4 mb-4">
        <div className="w-40 border border-[#c9c3c0] text-[12px]">
          <div className="flex justify-between border-b border-[#c9c3c0] px-2 py-1">
            <span className="text-neutral-500">شماره :</span>
            <span className="font-bold">{toDisplayDigits(doc.number)}</span>
          </div>
          <div className="flex justify-between px-2 py-1">
            <span className="text-neutral-500">تاریخ :</span>
            <span className="font-bold">{formatJalaliDate(issueDate)}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center text-center">
          {/* Paper is always white, so always the light-surface logo. */}
          <BrandLogo surface="light" className="mb-1 h-16" />
          {isInvoiceLike && <div className="text-xl font-bold text-[#3a3a3c]">{doc.company?.name ?? "رویا هاوس"}</div>}
          <div className="mt-1 text-lg font-bold text-[#ab2c33]">{meta.title}</div>
        </div>

        <div className="w-40 text-left text-[11px] text-neutral-500 leading-5">
          {doc.status === "DRAFT" && (
            <span className="inline-block border border-dashed border-[#c9c3c0] px-2 py-0.5 rounded text-neutral-500">
              پیش‌نویس
            </span>
          )}
        </div>
      </div>

      {isInvoiceLike && <PartyBox title="مشخصات فروشنده" party={seller} />}
      <PartyBox title="مشخصات خریدار" party={buyer} />

      {/* Items table */}
      <div className="mb-4">
        <SectionHeader note={isInvoiceLike ? "مبالغ به ریال" : undefined}>
          {isInvoiceLike ? "مشخصات کالا یا خدمات مورد معامله" : "مشخصات کالاهای خارج شده"}
        </SectionHeader>
        {/* The money columns say "(ریال)" once, in the section header above,
            rather than in all six headings: repeating it wrapped every heading
            onto three lines and squeezed the name column until the product
            names wrapped too, which is what pushed a ten-line invoice onto a
            second page. */}
        <table className="w-full table-fixed border-collapse border border-[#c9c3c0] text-[10px]">
          <thead>
            <tr className="bg-[#f3f0ef] text-center">
              <th className="border border-[#c9c3c0] px-1 py-1 w-7">ردیف</th>
              <th className="border border-[#c9c3c0] px-1 py-1">نام کالا</th>
              <th className="border border-[#c9c3c0] px-1 py-1 w-10">واحد</th>
              <th className="border border-[#c9c3c0] px-1 py-1 w-12">تعداد</th>
              {isInvoiceLike ? (
                <>
                  {/* Money columns are sized for the totals row, not the line
                      rows: the footer holds the sum of every line, so it is
                      always the widest number in its column. */}
                  <th className={cn(MONEY_CELL, "w-[57px]")}>مبلغ واحد</th>
                  <th className={cn(MONEY_CELL, "w-[79px]")}>مبلغ کل</th>
                  <th className={cn(MONEY_CELL, "w-[53px]")}>تخفیف</th>
                  <th className={cn(MONEY_CELL, "w-[78px]")}>پس از تخفیف</th>
                  <th className={cn(MONEY_CELL, "w-[70px]")}>مالیات و عوارض</th>
                  <th className={cn(MONEY_CELL, "w-[78px]")}>جمع کل</th>
                </>
              ) : (
                <th className="border border-[#c9c3c0] px-1 py-1">توضیحات</th>
              )}
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item: DocumentItem, idx: number) => {
              const t = computeLineTotal(item);
              return (
                <tr key={idx} className="text-center">
                  <td className="border border-[#c9c3c0] px-1 py-0.5">{toDisplayDigits(idx + 1)}</td>
                  <td className="border border-[#c9c3c0] px-2 py-0.5 text-right leading-tight">{item.name}</td>
                  <td className="border border-[#c9c3c0] px-1 py-0.5">{item.unit}</td>
                  <td className="border border-[#c9c3c0] px-1 py-0.5">{formatNumber(Number(item.quantity))}</td>
                  {isInvoiceLike ? (
                    <>
                      <td className={MONEY_CELL}>{formatToman(item.unitPrice * 10)}</td>
                      <td className={MONEY_CELL}>{formatToman(t.lineTotal * 10)}</td>
                      <td className={MONEY_CELL}>{formatToman((item.discount ?? 0) * 10)}</td>
                      <td className={MONEY_CELL}>{formatToman(t.afterDiscount * 10)}</td>
                      <td className={MONEY_CELL}>{formatToman(t.taxAmount * 10)}</td>
                      <td className={cn(MONEY_CELL, "font-bold")}>{formatToman(t.grandTotal * 10)}</td>
                    </>
                  ) : (
                    <td className="border border-[#c9c3c0] px-1 py-0.5 text-right leading-tight">{item.spec ?? ""}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {isInvoiceLike && (
            <tfoot>
              <tr className="bg-[#f7ebec] font-bold text-center text-[#3a3a3c]">
                <td className="border border-[#c9c3c0] px-1 py-1" colSpan={5}>
                  جمع کل : {tomanToRialWords(totals.grandTotal)}
                </td>
                <td className={MONEY_CELL}>{formatToman(totals.subtotal * 10)}</td>
                <td className={MONEY_CELL}>{formatToman(totals.discountTotal * 10)}</td>
                <td className={MONEY_CELL}>{formatToman((totals.subtotal - totals.discountTotal) * 10)}</td>
                <td className={MONEY_CELL}>{formatToman(totals.taxTotal * 10)}</td>
                <td className={cn(MONEY_CELL, "text-[#ab2c33]")}>{formatToman(totals.grandTotal * 10)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!isInvoiceLike && (
        <div data-print-ending className="mb-4 text-[12px] space-y-3">
          <div>
            <span className="text-neutral-500">شماره فاکتور: </span>
            <span className="font-bold">{doc.relatedInvoiceNo ? toDisplayDigits(doc.relatedInvoiceNo) : "—"}</span>
          </div>
          <div className="border border-[#c9c3c0] p-3 leading-8">
            <b>توضیحات:</b> سفارش فوق صحیح و سالم تحویل اینجانب{" "}
            <span className="inline-block min-w-[160px] border-b border-dotted border-neutral-500 px-1">
              {doc.deliveredToName ?? ""}
            </span>{" "}
            به کد ملی{" "}
            <span className="inline-block min-w-[120px] border-b border-dotted border-neutral-500 px-1">
              {doc.deliveredToNationalId ?? ""}
            </span>{" "}
            و شماره تماس ................... به مشخصات ماشین: رنگ{" "}
            <span className="inline-block min-w-[100px] border-b border-dotted border-neutral-500 px-1">
              {doc.vehicleColor ?? ""}
            </span>{" "}
            و شماره پلاک{" "}
            <span className="inline-block min-w-[120px] border-b border-dotted border-neutral-500 px-1">
              {doc.vehiclePlate ?? ""}
            </span>{" "}
            در تاریخ {formatJalaliDate(issueDate)} گردید.
          </div>
        </div>
      )}

      {isInvoiceLike && (
        <div data-print-ending className="mb-4 grid grid-cols-3 gap-3 text-[11px]">
          <div className="col-span-2 border border-[#c9c3c0] p-2 leading-6">
            <b>توضیحات:</b> {doc.notes || "1. اعتبار پیش‌فاکتور 24 ساعت از تاریخ صدور می‌باشد. 2. واریز پیش‌پرداخت به منزله تایید پیش‌فاکتور می‌باشد. 3. در صورت فروش شرایطی، تا زمان تسویه کامل، کلیه سفارش نزد خریدار محترم امانت خواهد بود."}
          </div>
          <div className="border border-[#c9c3c0] p-2 leading-6">
            <b>مانده حساب مشتری:</b>
            <div className="mt-1">ثبت نشده</div>
          </div>
        </div>
      )}

      {/* Signatures */}
      <div data-print-ending className="grid grid-cols-2 gap-4 mt-4">
        {isInvoiceLike ? (
          <>
            <SignatureBox label="مهر و امضاء خریدار" />
            <SignatureBox label="مهر و امضاء فروشنده" />
          </>
        ) : (
          <>
            <SignatureBox label="مهر و امضاء تحویل گیرنده" />
            <SignatureBox label="مهر و امضاء تحویل دهنده" />
          </>
        )}
      </div>

      <div data-print-ending className="mt-4 bg-[#464646] text-center py-2 text-[12px] font-bold text-white">
        از خرید شما سپاسگزاریم.
      </div>
    </div>
  );
}
