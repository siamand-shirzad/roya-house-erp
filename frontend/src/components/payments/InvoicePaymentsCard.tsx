import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HandCoins } from "lucide-react";

import { PaymentDialog } from "@/components/payments/PaymentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/api";
import { formatJalaliDate, formatToman, toDisplayDigits } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { CHEQUE_STATUS_LABELS, PAYMENT_METHOD_LABELS, paymentState, type Document, type Payment } from "@/types";

const STATE_LABEL = { UNPAID: "پرداخت‌نشده", PARTIAL: "پرداخت ناقص", PAID: "تسویه‌شده" } as const;
const STATE_TONE = {
  UNPAID: "border-red-600/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300",
  PARTIAL: "border-amber-600/25 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
  PAID: "border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
} as const;

export function PaymentStateBadge({ doc, className }: { doc: Document; className?: string }) {
  const s = paymentState(doc);
  if (!s) return null;
  return (
    <Badge variant="outline" className={cn(STATE_TONE[s.state], className)}>
      {STATE_LABEL[s.state]}
    </Badge>
  );
}

// Settlement of one issued invoice: paid vs. due, the receipts behind it, and
// "record a payment" pre-filled with the invoice's customer and remainder.
export function InvoicePaymentsCard({ doc, onChanged }: { doc: Document; onChanged: () => void }) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const state = paymentState(doc);

  useEffect(() => {
    if (!can(user, "payments")) return;
    api.payments.list({ documentId: doc.id }).then(setPayments).catch(() => setPayments([]));
  }, [doc.id, user, version]);

  if (!state || !can(user, "payments")) return null;
  const pct = doc.totals.grandTotal ? (state.paid / doc.totals.grandTotal) * 100 : 0;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          دریافت‌های این فاکتور <PaymentStateBadge doc={doc} />
        </CardTitle>
        <CardDescription className="tabular-nums">
          پرداخت‌شده {formatToman(state.paid)} از {formatToman(doc.totals.grandTotal)} تومان · مانده{" "}
          <span className="font-semibold text-foreground">{formatToman(Math.max(0, state.due))}</span>
        </CardDescription>
        {can(user, "payments", true) && state.due > 0 && (
          <CardAction>
            <Button size="sm" onClick={() => setOpen(true)}>
              <HandCoins /> ثبت دریافت
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <Progress value={pct} aria-label="درصد پرداخت‌شده" />
        {payments && payments.length > 0 && (
          <ul className="divide-y rounded-md border text-sm">
            {payments.map((p) => (
              <li key={p.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2", p.status === "CANCELLED" && "text-muted-foreground line-through")}>
                <span className="tabular-nums">رسید {toDisplayDigits(p.number)}</span>
                <span>{formatJalaliDate(new Date(`${p.paidAt}T12:00:00`))}</span>
                <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                {p.chequeStatus && <span className="text-xs text-muted-foreground">({CHEQUE_STATUS_LABELS[p.chequeStatus]})</span>}
                <span className="ms-auto font-semibold tabular-nums">{formatToman(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/payments" className="text-xs text-muted-foreground hover:text-foreground">
          همه‌ی دریافت‌ها و چک‌ها ←
        </Link>
      </CardContent>
      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        preset={{
          customer: doc.customer ? { id: doc.customer.id, name: doc.customer.name } : null,
          invoice: { id: doc.id, number: doc.number, due: state.due },
        }}
        onSaved={() => {
          setVersion((v) => v + 1);
          onChanged();
        }}
      />
    </Card>
  );
}
