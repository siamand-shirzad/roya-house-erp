import { can, type Module } from "@/lib/permissions";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { DOCUMENT_TYPE_LABELS, type Document, type AuthUser } from "@/types";

export function FollowUpTasks({ documents, user }: { documents: Document[]; user: AuthUser }) {
  const tasks = documents.flatMap((doc) => {
    if (doc.status === "DRAFT" && can(user, doc.type.toLowerCase() as Module, true)) return [{ doc, label: "تکمیل پیش‌نویس" }];
    if (doc.status !== "ISSUED") return [];
    if (doc.type === "PROFORMA" && can(user, "invoice", true) && !doc.derived?.some((d) => d.type === "INVOICE" && d.status !== "CANCELLED")) return [{ doc, label: "پیگیری صدور فاکتور" }];
    if (doc.type === "INVOICE" && can(user, "goods_issue", true) && !documents.some((d) => d.type === "GOODS_ISSUE" && d.status !== "CANCELLED" && (d.source?.id === doc.id || d.relatedInvoiceNo === String(doc.number)))) return [{ doc, label: "آماده‌سازی حواله خروج" }];
    return [];
  }).sort((a, b) => Date.parse(a.doc.issueDate) - Date.parse(b.doc.issueDate));
  return <Card>
    <CardHeader><CardTitle>نیازمند پیگیری</CardTitle><CardDescription>{tasks.length} مورد · تمام دوره‌ها · قدیمی‌ترین‌ها ابتدا</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-2">
      {!tasks.length && <p className="py-4 text-sm text-muted-foreground">کاری برای پیگیری در نقش شما وجود ندارد.</p>}
      {tasks.slice(0, 6).map(({ doc, label }) => <Link key={doc.id} to={`/documents/${TYPE_TO_SLUG[doc.type]}/${doc.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 hover:bg-muted/50 focus-visible:outline focus-visible:outline-ring">
        <span className="flex flex-1 flex-col gap-1"><span className="text-sm font-medium">{label} · {DOCUMENT_TYPE_LABELS[doc.type].short} {doc.number}</span><span className="text-xs text-muted-foreground">{doc.buyerName || doc.customer?.name || "بدون نام خریدار"}</span></span><StatusBadge status={doc.status} />
      </Link>)}
      {tasks.length > 6 && <p className="text-xs text-muted-foreground">۶ مورد قدیمی‌تر نمایش داده شده است. بقیه را در فهرست اسناد ببینید.</p>}
    </CardContent>
  </Card>;
}
