import { useMemo, type ReactNode } from "react";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatToman, toDisplayDigits } from "@/lib/format";
import { REVEAL, stagger } from "@/lib/motion";
import { computeLineTotal } from "@/lib/totals";
import type { Document } from "@/types";

// "Who and what sold" over the last 30 days, in the studio-admin CRM
// "sales by region" style: amount, then a share bar with its percentage.
// Product amounts are after discount and before tax, like the reports page.

const DAY_MS = 86_400_000;
const SHOWN = 5;

type Row = { key: string; label: string; sublabel: string; amount: number };

function recentInvoices(documents: Document[]) {
  const since = Date.now() - 30 * DAY_MS;
  return documents.filter(
    (d) => d.type === "INVOICE" && d.status === "ISSUED" && new Date(d.issueDate).getTime() >= since,
  );
}

function rank<T extends Row>(map: Map<string, T>) {
  const rows = [...map.values()].sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return { rows: rows.slice(0, SHOWN), total, count: rows.length };
}

export function TopProducts(props: { documents: Document[]; loading: boolean; failed?: boolean }) {
  const ranked = useMemo(() => {
    const map = new Map<string, Row & { quantity: number; unit: string }>();
    for (const doc of recentInvoices(props.documents)) {
      for (const item of doc.items) {
        const key = item.productId ?? `${item.name}|${item.unit}`;
        const row = map.get(key) ?? { key, label: item.name, sublabel: "", amount: 0, quantity: 0, unit: item.unit };
        row.amount += computeLineTotal(item).afterDiscount;
        row.quantity += item.quantity;
        row.sublabel = `${formatNumber(row.quantity)} ${row.unit}`;
        map.set(key, row);
      }
    }
    return rank(map);
  }, [props.documents]);

  return (
    <LeaderCard
      {...props}
      index={6}
      title="کالاهای پرفروش"
      description="30 روز اخیر · پس از تخفیف و بدون مالیات (تومان)"
      ranked={ranked}
      footer={(n) => `${toDisplayDigits(n)} کالا در این بازه فروش رفته است`}
    />
  );
}

export function TopCustomers(props: { documents: Document[]; loading: boolean; failed?: boolean }) {
  const ranked = useMemo(() => {
    const map = new Map<string, Row & { invoices: number }>();
    for (const doc of recentInvoices(props.documents)) {
      const name = doc.buyerName || doc.customer?.name || "بدون نام";
      const key = doc.customer?.id ?? `name:${name}`;
      const row = map.get(key) ?? { key, label: name, sublabel: "", amount: 0, invoices: 0 };
      row.amount += doc.totals.grandTotal;
      row.invoices += 1;
      row.sublabel = `${toDisplayDigits(row.invoices)} فاکتور`;
      map.set(key, row);
    }
    return rank(map);
  }, [props.documents]);

  return (
    <LeaderCard
      {...props}
      index={7}
      title="مشتریان برتر"
      description="30 روز اخیر · جمع فاکتورها (تومان)"
      ranked={ranked}
      footer={(n) => `${toDisplayDigits(n)} مشتری در این بازه خرید کرده‌اند`}
    />
  );
}

function LeaderCard({
  title,
  description,
  ranked,
  footer,
  loading,
  failed,
  index,
}: {
  title: string;
  description: string;
  ranked: { rows: Row[]; total: number; count: number };
  footer: (count: number) => string;
  loading: boolean;
  failed?: boolean;
  index: number;
}) {
  let body: ReactNode;
  if (loading) {
    body = (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    );
  } else if (failed) {
    body = <p className="py-8 text-center text-sm text-destructive">دریافت اسناد ناموفق بود.</p>;
  } else if (ranked.rows.length === 0) {
    body = <p className="py-8 text-center text-sm text-muted-foreground">در 30 روز اخیر فروشی ثبت نشده است.</p>;
  } else {
    body = (
      <ol className="space-y-3">
        {ranked.rows.map((r) => {
          const share = ranked.total ? Math.round((r.amount / ranked.total) * 100) : 0;
          return (
            <li key={r.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">
                  {r.label}
                  <span className="ms-2 text-xs font-normal text-muted-foreground tabular-nums">{r.sublabel}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatToman(r.amount)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={Math.max(2, share)} aria-label={`سهم ${r.label}`} />
                <span className="w-9 shrink-0 text-end text-xs font-medium text-muted-foreground tabular-nums">
                  {toDisplayDigits(share)}%
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <Card className={REVEAL} style={stagger(index)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">{body}</CardContent>
      {!loading && !failed && ranked.count > 0 && (
        <CardFooter className="text-xs text-muted-foreground">
          {footer(ranked.count)} · جمع {formatToman(ranked.total)}
        </CardFooter>
      )}
    </Card>
  );
}
