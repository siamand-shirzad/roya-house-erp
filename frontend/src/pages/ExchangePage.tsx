import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, Contact, DatabaseBackup, Download, HandCoins, ReceiptText, Tags, TriangleAlert, Warehouse } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ShamsiDatePicker } from "@/components/shamsi-date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { toDisplayDigits } from "@/lib/format";
import type { SepidarSummary } from "@/types";

// Data exchange with Sepidar: CSV files laid out like Sepidar's "import from
// Excel" screens (parties, goods, sales invoices, receipts, stock), and a JSON
// backup of the whole database. Amounts in the files are Rial and dates are
// Shamsi, as Sepidar expects (see backend/src/routes/exchange.ts).

type ExportFile = {
  path: string;
  title: string;
  description: string;
  icon: ReactNode;
  ranged?: boolean;
  warning?: (s: SepidarSummary) => string | null;
};

const FILES: ExportFile[] = [
  {
    path: "sepidar/parties.csv",
    title: "طرف حساب‌ها",
    description: "مشتریان و تأمین‌کنندگان با کد، شناسه ملی، کد اقتصادی و نشانی.",
    icon: <Contact />,
    warning: (s) => (s.partiesWithoutCode ? `${toDisplayDigits(s.partiesWithoutCode)} طرف حساب کد سپیدار ندارد.` : null),
  },
  {
    path: "sepidar/products.csv",
    title: "کالاها",
    description: "کد، نام، واحد، گروه، قیمت فروش و آخرین فی خرید (ریال).",
    icon: <Tags />,
    warning: (s) => (s.productsWithoutCode ? `${toDisplayDigits(s.productsWithoutCode)} کالا کد ندارد.` : null),
  },
  {
    path: "sepidar/invoices.csv",
    title: "فاکتورهای فروش",
    description: "فقط فاکتورهای صادرشده، هر ردیف کالا در یک سطر، با تخفیف و مالیات (ریال).",
    icon: <ReceiptText />,
    ranged: true,
    warning: (s) =>
      s.invoicesWithoutParty ? `${toDisplayDigits(s.invoicesWithoutParty)} فاکتور به طرف حسابِ ثبت‌شده وصل نیست.` : null,
  },
  {
    path: "sepidar/payments.csv",
    title: "رسیدهای دریافت",
    description: "نقد، کارتخوان، حواله بانکی و چک (با شماره، بانک و سررسید). چک برگشتی و رسید باطل حذف شده‌اند.",
    icon: <HandCoins />,
    ranged: true,
  },
  {
    path: "sepidar/stock.csv",
    title: "رسید و حواله انبار",
    description: "ورود کالا (با تأمین‌کننده و فی خرید)، حواله‌های فروش، برگشت‌ها و تعدیل انبارگردانی.",
    icon: <Warehouse />,
    ranged: true,
  },
];

export function ExchangePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SepidarSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    api.exchange
      .summary()
      .then(setSummary)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const range = { from: from || undefined, to: to || undefined };

  return (
    <AppShell title="تبادل با سپیدار">
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <section className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">خروجی برای سپیدار</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            فایل‌ها با ساختار «ورود اطلاعات از اکسل» سپیدار ساخته می‌شوند: مبالغ به <b>ریال</b>، تاریخ‌ها <b>شمسی</b>، طرف حساب و
            کالا با <b>کد</b>. فایل CSV را در اکسل باز کنید، با پسوند xlsx ذخیره کنید و در سپیدار ستون‌ها را تطبیق دهید. قالب
            سپیدار در نسخه‌های مختلف کمی فرق دارد؛ بار اول ستون‌ها را با قالب نسخه‌ی خودتان مقایسه کنید.
          </p>
        </section>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="font-medium">بازه‌ی فاکتورها، دریافت‌ها و گردش انبار:</span>
          <ShamsiDatePicker label="از ابتدا" value={from} max={to || undefined} onChange={setFrom} />
          <span className="text-muted-foreground">تا</span>
          <ShamsiDatePicker label="تا امروز" value={to} min={from || undefined} onChange={setTo} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FILES.map((f) => {
            const warning = summary && f.warning ? f.warning(summary) : null;
            return (
              <Card key={f.path} className="gap-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base [&_svg]:size-4 [&_svg]:text-primary">
                    {f.icon} {f.title}
                  </CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                  <CardAction>
                    <Button size="sm" asChild>
                      <a href={api.exchange.url(f.path, f.ranged ? range : undefined)} download>
                        <Download /> دانلود
                      </a>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="text-xs">
                  {!summary ? (
                    <Skeleton className="h-4 w-40" />
                  ) : warning ? (
                    <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        {warning}{" "}
                        {f.path.includes("parties") ? (
                          <Link to="/customers" className="underline">تکمیل در طرف حساب‌ها</Link>
                        ) : f.path.includes("products") ? (
                          <Link to="/products" className="underline">تکمیل در کالاها</Link>
                        ) : null}
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                      <CircleCheck className="size-3.5" /> آماده
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <section className="space-y-2">
          <h3 className="font-semibold">ترتیب پیشنهادی ورود به سپیدار</h3>
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>طرف حساب‌ها و کالاها (یک بار، و بعد هر وقت مورد تازه اضافه شد).</li>
            <li>رسیدهای انبار، تا موجودی و بهای تمام‌شده در سپیدار درست باشد.</li>
            <li>فاکتورهای فروش هر دوره (مثلاً ماهانه).</li>
            <li>رسیدهای دریافت همان دوره، با شماره فاکتور برای تسویه.</li>
          </ol>
        </section>

        {user?.role === "ADMIN" && (
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DatabaseBackup className="size-4 text-primary" /> پشتیبان کامل
              </CardTitle>
              <CardDescription>
                همه‌ی اسناد، کالاها، طرف حساب‌ها، دریافت‌ها و گردش انبار در یک فایل JSON. رمزهای عبور در فایل نیستند. فایل را
                جای امن نگه دارید؛ بازگردانی از پشتیبان هنوز از داخل برنامه ممکن نیست و در نسخه‌ی بعد اضافه می‌شود.
              </CardDescription>
              <CardAction>
                <Button size="sm" variant="outline" asChild>
                  <a href={api.exchange.url("backup")} download>
                    <Download /> دانلود پشتیبان
                  </a>
                </Button>
              </CardAction>
            </CardHeader>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
