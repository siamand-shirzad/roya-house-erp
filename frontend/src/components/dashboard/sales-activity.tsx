import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SegmentedControl } from "@/components/segmented-control";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatJalaliDate,
  formatJalaliMonth,
  formatNumber,
  formatToman,
  formatTomanCompact,
  toDisplayDigits,
  toJalali,
} from "@/lib/format";
import { DocumentTypeIcon } from "@/lib/icons";
import { REVEAL, stagger } from "@/lib/motion";
import type { Document } from "@/types";

// Dashboard sales activity (after the studio-admin CRM "lead flow" card):
// issued invoices per day (30 days) or per Jalali month (12 months) on the
// start side, the period total and how much of it has left the warehouse on
// the end side. Empty days/months still get a bar slot, so gaps read as gaps.

type Span = "30d" | "12m";
const SPANS: { value: Span; label: string }[] = [
  { value: "30d", label: "30 روز" },
  { value: "12m", label: "12 ماه" },
];

type Bucket = { key: string; label: string; title: string; total: number; count: number };

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => {
  const { jy, jm } = toJalali(d);
  return `${jy}-${jm}`;
};

function emptyBuckets(span: Span): { buckets: Bucket[]; keyOf: (d: Date) => string } {
  const now = new Date();
  const buckets: Bucket[] = [];
  if (span === "30d") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const { jm, jd } = toJalali(d);
      buckets.push({ key: dayKey(d), label: toDisplayDigits(`${jm}/${jd}`), title: formatJalaliDate(d), total: 0, count: 0 });
    }
    return { buckets, keyOf: dayKey };
  }
  let { jy, jm } = toJalali(now);
  for (let i = 0; i < 12; i++) {
    const title = formatJalaliMonth(jy, jm);
    buckets.unshift({ key: `${jy}-${jm}`, label: title.split(" ")[0], title, total: 0, count: 0 });
    jm -= 1;
    if (jm === 0) {
      jm = 12;
      jy -= 1;
    }
  }
  return { buckets, keyOf: monthKey };
}

export function SalesActivity({
  documents,
  loading,
  failed,
}: {
  /** All documents; goods issues are needed to tell which invoices were delivered. */
  documents: Document[];
  loading: boolean;
  /** The documents request failed; empty bars would read as "no sales". */
  failed?: boolean;
}) {
  const [span, setSpan] = useState<Span>("30d");

  const { data, total, count, delivered } = useMemo(() => {
    const { buckets, keyOf } = emptyBuckets(span);
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    // An invoice counts as delivered once a non-cancelled goods issue points
    // at it, by conversion link or by the hand-typed invoice number.
    const deliveredIds = new Set<string>();
    const deliveredNumbers = new Set<string>();
    for (const d of documents) {
      if (d.type !== "GOODS_ISSUE" || d.status === "CANCELLED") continue;
      if (d.source?.id) deliveredIds.add(d.source.id);
      if (d.relatedInvoiceNo) deliveredNumbers.add(d.relatedInvoiceNo.trim());
    }
    let total = 0;
    let count = 0;
    let delivered = 0;
    for (const doc of documents) {
      if (doc.type !== "INVOICE" || doc.status !== "ISSUED") continue;
      const bucket = byKey.get(keyOf(new Date(doc.issueDate)));
      if (!bucket) continue;
      bucket.total += doc.totals.grandTotal;
      bucket.count += 1;
      total += doc.totals.grandTotal;
      count += 1;
      if (deliveredIds.has(doc.id) || deliveredNumbers.has(String(doc.number))) delivered += 1;
    }
    return { data: buckets, total, count, delivered };
  }, [documents, span]);

  const deliveredPct = count ? Math.round((delivered / count) * 100) : 0;
  const spanText = span === "30d" ? "30 روز اخیر" : "12 ماه اخیر";

  return (
    <Card className={REVEAL} style={stagger(4)}>
      <CardHeader>
        <CardTitle>روند فروش</CardTitle>
        <CardDescription className={failed && !loading ? "text-destructive" : undefined}>
          {failed && !loading
            ? "دریافت فاکتورها ناموفق بود؛ نمودار خالی به معنی نبود فروش نیست."
            : `جمع فاکتورهای صادرشده در هر ${span === "30d" ? "روز" : "ماه"} (تومان)`}
        </CardDescription>
        <CardAction>
          <SegmentedControl ariaLabel="بازه‌ی نمودار" size="sm" items={SPANS} value={span} onValueChange={setSpan} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 @5xl/main:grid-cols-12">
          <div className="@5xl/main:col-span-8">
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : count === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <DocumentTypeIcon type="INVOICE" className="size-6 opacity-50" />
                در {spanText} فاکتور صادرشده‌ای نیست.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap={span === "30d" ? 3 : 10}>
                  <defs>
                    <pattern id="sales-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="var(--chart-1)" fillOpacity="0.18" />
                      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-1)" strokeWidth="1.25" strokeOpacity="0.55" />
                    </pattern>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    reversed
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={12}
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
                      `${formatToman(Number(value ?? 0))} تومان — ${toDisplayDigits((item?.payload as Bucket)?.count ?? 0)} فاکتور`,
                      "فروش",
                    ]}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload as Bucket | undefined)?.title ?? ""}
                  />
                  <Bar
                    dataKey="total"
                    fill="url(#sales-hatch)"
                    stroke="var(--chart-1)"
                    strokeOpacity={0.6}
                    strokeWidth={0.75}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={span === "30d" ? 22 : 40}
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-col gap-5 rounded-lg p-1 @5xl/main:col-span-4 @5xl/main:p-4">
            <div className="flex flex-col gap-1.5">
              <div className="font-display text-3xl leading-none font-semibold tabular-nums">
                {loading ? <Skeleton className="h-9 w-40" /> : failed ? "—" : formatToman(total)}{" "}
                <span className="font-sans text-base font-normal text-muted-foreground">تومان</span>
              </div>
              <p className="text-sm text-muted-foreground">
                فروش {spanText} از {loading || failed ? "—" : formatNumber(count)} فاکتور صادرشده.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
              <div className="text-[11px] font-medium tracking-wide text-muted-foreground">تحویل از انبار</div>
              <div className="flex flex-col gap-1.5">
                <div className="font-display text-2xl leading-none font-semibold tabular-nums">
                  {loading || failed ? "—" : formatNumber(delivered)}{" "}
                  <span className="font-sans text-sm font-normal text-muted-foreground">فاکتور حواله‌شده</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {count
                    ? `${toDisplayDigits(deliveredPct)}% از فاکتورهای این بازه حواله‌ی خروج دارند.`
                    : "در این بازه فاکتوری برای تحویل نیست."}
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-0.5">
                <Progress value={deliveredPct} className="h-2.5 bg-chart-1/12" aria-label="درصد فاکتورهای حواله‌شده" />
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium tabular-nums">{toDisplayDigits(delivered)} حواله‌شده</span>
                  <span className="text-muted-foreground tabular-nums">{toDisplayDigits(count)} فاکتور</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
