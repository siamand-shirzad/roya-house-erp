import { can, type Module } from "@/lib/permissions";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { formatToman, toDisplayDigits } from "@/lib/format";
import { DocumentTypeIcon } from "@/lib/icons";
import { REVEAL, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPE_LABELS, type Document, type AuthUser } from "@/types";

const DAY_MS = 86_400_000;
const SHOWN = 5;

// Age is the "priority": older than a month is urgent, older than a week is
// worth a look. Always words and an icon as well as colour.
function AgeChip({ days }: { days: number }) {
  const tone =
    days > 30
      ? "bg-destructive/10 text-destructive"
      : days > 7
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums", tone)}>
      <Clock className="size-3" />
      {days === 0 ? "امروز" : `${toDisplayDigits(days)} روز`}
    </span>
  );
}

export function FollowUpTasks({ documents, user }: { documents: Document[]; user: AuthUser }) {
  const tasks = documents.flatMap((doc) => {
    if (doc.status === "DRAFT" && can(user, doc.type.toLowerCase() as Module, true)) return [{ doc, label: "تکمیل پیش‌نویس" }];
    if (doc.status !== "ISSUED") return [];
    if (doc.type === "PROFORMA" && can(user, "invoice", true) && !doc.derived?.some((d) => d.type === "INVOICE" && d.status !== "CANCELLED")) return [{ doc, label: "پیگیری صدور فاکتور" }];
    if (doc.type === "INVOICE" && can(user, "goods_issue", true) && !documents.some((d) => d.type === "GOODS_ISSUE" && d.status !== "CANCELLED" && (d.source?.id === doc.id || d.relatedInvoiceNo === String(doc.number)))) return [{ doc, label: "آماده‌سازی حواله خروج" }];
    return [];
  }).sort((a, b) => Date.parse(a.doc.issueDate) - Date.parse(b.doc.issueDate));
  const today = Date.now();

  return <Card className={REVEAL} style={stagger(5)}>
    <CardHeader>
      <CardTitle>نیازمند پیگیری</CardTitle>
      <CardDescription>{toDisplayDigits(tasks.length)} مورد در 12 ماه اخیر · قدیمی‌ترین‌ها ابتدا</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-2.5">
      {!tasks.length && <p className="py-8 text-center text-sm text-muted-foreground">کاری برای پیگیری در نقش شما وجود ندارد.</p>}
      {tasks.slice(0, SHOWN).map(({ doc, label }) => {
        const days = Math.max(0, Math.floor((today - Date.parse(doc.issueDate)) / DAY_MS));
        return <Link key={doc.id} to={`/documents/${TYPE_TO_SLUG[doc.type]}/${doc.id}`} className="group flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-ring">
          <span className="flex items-center gap-2">
            <DocumentTypeIcon type={doc.type} className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label} · {DOCUMENT_TYPE_LABELS[doc.type].short} <span className="tabular-nums">{toDisplayDigits(doc.number)}</span></span>
            <AgeChip days={days} />
          </span>
          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{doc.buyerName || doc.customer?.name || "بدون نام خریدار"}{doc.type !== "GOODS_ISSUE" && <> · <span className="tabular-nums">{formatToman(doc.totals.grandTotal)}</span> تومان</>}</span>
            <StatusBadge status={doc.status} className="text-[11px]" />
          </span>
        </Link>;
      })}
      {tasks.length > SHOWN && <p className="text-xs text-muted-foreground">{toDisplayDigits(SHOWN)} مورد قدیمی‌تر از {toDisplayDigits(tasks.length)} نمایش داده شده است. بقیه را در فهرست اسناد ببینید.</p>}
    </CardContent>
  </Card>;
}
