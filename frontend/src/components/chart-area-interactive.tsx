import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatJalaliDate, formatToman, formatTomanCompact, toDisplayDigits, toJalali } from "@/lib/format";
import { DocumentTypeIcon } from "@/lib/icons";
import { REVEAL, stagger } from "@/lib/motion";
import type { Document } from "@/types";

// Dashboard sales trend: issued invoices summed per day over the last 30 days.
// It used to plot every invoice as its own point in date order, which drew a
// "trend" line between unrelated invoices and hid days with no sales. Days
// with nothing sold now show as empty bars, so gaps read as gaps.

const DAYS = 30;

type Day = { key: string; label: string; title: string; total: number; count: number };

function localDayKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ChartAreaInteractive({ invoices, loading }: { invoices: Document[]; loading: boolean }) {
  const data = useMemo<Day[]>(() => {
    const now = new Date();
    const days: Day[] = [];
    const byKey = new Map<string, Day>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const { jm, jd } = toJalali(d);
      const day = { key: localDayKey(d), label: toDisplayDigits(`${jm}/${jd}`), title: formatJalaliDate(d), total: 0, count: 0 };
      days.push(day);
      byKey.set(day.key, day);
    }
    for (const doc of invoices) {
      if (doc.status !== "ISSUED") continue;
      const day = byKey.get(localDayKey(new Date(doc.issueDate)));
      if (!day) continue;
      day.total += doc.totals.grandTotal;
      day.count += 1;
    }
    return days;
  }, [invoices]);

  const periodTotal = data.reduce((sum, d) => sum + d.total, 0);
  const periodCount = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className={REVEAL} style={stagger(4)}>
      <CardHeader>
        <CardTitle>فروش 30 روز اخیر</CardTitle>
        <CardDescription>
          {loading
            ? "در حال بارگذاری..."
            : `جمع فاکتورهای صادرشده در هر روز — ${formatToman(periodTotal)} تومان از ${toDisplayDigits(periodCount)} فاکتور`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : periodCount === 0 ? (
          <div className="flex h-[250px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <DocumentTypeIcon type="INVOICE" className="size-6 opacity-50" />
            در 30 روز اخیر فاکتور صادرشده‌ای نیست.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                reversed
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                interval="preserveStartEnd"
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                orientation="right"
                width={56}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTomanCompact}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--popover-foreground)",
                  direction: "rtl",
                  fontFamily: "inherit",
                }}
                formatter={(value, _name, item) => [
                  `${formatToman(Number(value ?? 0))} تومان — ${toDisplayDigits((item?.payload as Day)?.count ?? 0)} فاکتور`,
                  "فروش",
                ]}
                labelFormatter={(_, payload) => (payload?.[0]?.payload as Day | undefined)?.title ?? ""}
              />
              <Bar
                dataKey="total"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
