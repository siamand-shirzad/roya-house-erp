import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ReceiptIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatJalaliDate, formatToman, toDisplayDigits } from "@/lib/format";
import type { Document } from "@/types";

// Compact axis labels: 35,000,000 -> "35 م" (million Toman).
function compactToman(value: number) {
  if (value >= 1_000_000) return `${toDisplayDigits(Math.round(value / 100_000) / 10)} م`;
  if (value >= 1_000) return `${toDisplayDigits(Math.round(value / 1_000))} هزار`;
  return toDisplayDigits(value);
}

export function ChartAreaInteractive() {
  const [invoices, setInvoices] = useState<Document[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.documents
      .list("INVOICE")
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoaded(true));
  }, []);

  const data = useMemo(() => {
    return [...invoices]
      .sort((a, b) => (a.issueDate > b.issueDate ? 1 : -1))
      .map((doc) => ({
        date: formatJalaliDate(new Date(doc.issueDate)),
        total: doc.totals.grandTotal,
        label: `فاکتور ${toDisplayDigits(doc.number)} — ${doc.buyerName || doc.customer?.name || "بدون نام"}`,
      }));
  }, [invoices]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>روند فروش</CardTitle>
        <CardDescription>مبلغ فاکتورهای فروش به ترتیب تاریخ صدور (تومان)</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {loaded && data.length === 0 ? (
          <div className="flex h-[250px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <ReceiptIcon className="size-6 opacity-50" />
            هنوز فاکتوری برای نمایش نمودار ثبت نشده است.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                reversed
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                orientation="right"
                width={56}
                tickLine={false}
                axisLine={false}
                tickFormatter={compactToman}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--popover-foreground)",
                  direction: "rtl",
                  fontFamily: "inherit",
                }}
                formatter={(value) => [`${formatToman(Number(value ?? 0))} تومان`, "مبلغ"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""}
              />
              <Area
                dataKey="total"
                type="monotone"
                fill="url(#fillTotal)"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
