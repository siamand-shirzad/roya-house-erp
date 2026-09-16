import { Fragment, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  Building2,
  ChartColumn,
  Contact,
  HandCoins,
  Keyboard,
  PackagePlus,
  Rocket,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Kbd } from "@/components/kbd";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DOCUMENT_TYPE_ICONS, DocumentTypeIcon } from "@/lib/icons";
import { REVEAL, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

// How the business runs through the app, from setup to Sepidar. Static
// content; every step links to the page where it happens.

type Step = { title: string; body: ReactNode; to?: string; linkText?: string };
type Section = { id: string; title: string; icon: LucideIcon; intro: string; steps: Step[] };

const FLOW: { label: string; icon: ReactNode; to: string; who: string }[] = [
  { label: "پیش‌فاکتور", icon: <DocumentTypeIcon type="PROFORMA" />, to: "/documents/proforma", who: "فروش" },
  { label: "فاکتور فروش", icon: <DocumentTypeIcon type="INVOICE" />, to: "/documents/invoice", who: "فروش" },
  { label: "دریافت وجه", icon: <HandCoins />, to: "/payments", who: "حسابداری" },
  { label: "حواله خروج", icon: <DocumentTypeIcon type="GOODS_ISSUE" />, to: "/documents/goods-issue", who: "انبار" },
  { label: "خروجی سپیدار", icon: <ArrowLeftRight />, to: "/exchange", who: "حسابداری" },
];

const SECTIONS: Section[] = [
  {
    id: "setup",
    title: "راه‌اندازی (یک بار)",
    icon: Rocket,
    intro: "پیش از صدور اولین سند، این اطلاعات پایه را کامل کنید.",
    steps: [
      { title: "اطلاعات شرکت", body: "نام، شناسه ملی، کد اقتصادی و نشانی فروشنده؛ روی همه‌ی اسناد چاپ می‌شود.", to: "/settings/company", linkText: "اطلاعات شرکت" },
      { title: "کاربران و دسترسی‌ها", body: "برای هر نفر کاربر بسازید. نقش (فروش، انبار، حسابداری، مدیر) دسترسی پیش‌فرض را تعیین می‌کند و برای هر بخش می‌توان «مشاهده» یا «ویرایش» را جداگانه داد.", to: "/users", linkText: "کاربران" },
      { title: "کالاها و قیمت‌ها", body: "فهرست قیمت را از فایل CSV وارد کنید یا در جدول ویرایش کنید. کد کالا را همان کد سپیدار بگذارید.", to: "/products", linkText: "کالاها و قیمت‌ها" },
      { title: "طرف حساب‌ها", body: "مشتریان و تأمین‌کنندگان را با «کد طرف حساب» سپیدار ثبت کنید؛ بدون کد، خروجی سپیدار ناقص می‌ماند.", to: "/customers", linkText: "طرف حساب‌ها" },
      { title: "موجودی اول دوره", body: "در انبار، برای هر کالا «اصلاح موجودی» بزنید و عدد شمارش‌شده را وارد کنید.", to: "/inventory", linkText: "موجودی و گردش" },
    ],
  },
  {
    id: "sales",
    title: "چرخه‌ی فروش",
    icon: DOCUMENT_TYPE_ICONS.INVOICE,
    intro: "هر سند ابتدا پیش‌نویس است و با «صدور» قفل می‌شود. سند صادرشده حذف نمی‌شود؛ فقط باطل می‌شود.",
    steps: [
      { title: "پیش‌فاکتور", body: "مشتری را انتخاب کنید، اقلام را اضافه کنید و «اعتبار تا» را تعیین کنید (3، 7، 15 یا 30 روز). بعد از صدور، با «ارسال» PDF را در واتساپ یا تلگرام بفرستید. اصلاح پیش‌فاکتور صادرشده با «نسخه جدید» انجام می‌شود.", to: "/documents/proforma/new", linkText: "پیش‌فاکتور جدید" },
      { title: "تبدیل به فاکتور", body: "روی پیش‌فاکتور صادرشده «تبدیل به فاکتور» بزنید؛ اقلام و خریدار کپی می‌شوند. فاکتور را بازبینی و صادر کنید." },
      { title: "دریافت وجه", body: "روی فاکتور صادرشده، کارت «دریافت‌های این فاکتور» مانده را نشان می‌دهد. «ثبت دریافت» مبلغ مانده را پیش‌فرض می‌گذارد. دریافت چندمرحله‌ای (پیش‌پرداخت، چک) مجاز است.", to: "/payments", linkText: "دریافت‌ها" },
      { title: "حواله خروج", body: "انبار روی فاکتور «تبدیل به حواله» می‌زند، مشخصات تحویل (راننده، پلاک) را کامل و صادر می‌کند. با صدور، کالا از موجودی کسر می‌شود. اگر موجودی کم باشد هشدار می‌دهد ولی جلوی کار را نمی‌گیرد." },
    ],
  },
  {
    id: "warehouse",
    title: "انبار و خرید",
    icon: Warehouse,
    intro: "موجودی هیچ‌وقت دستی نوشته نمی‌شود؛ جمع گردش‌های کالاست.",
    steps: [
      { title: "ورود کالا (رسید خرید)", body: "کالاهای رسیده را با تعداد، تأمین‌کننده و فی خرید وارد کنید. فی خرید، بهای تمام‌شده‌ی کالا می‌شود و سود ناخالص گزارش از آن حساب می‌شود.", to: "/inventory?receipt=1", linkText: "ورود کالا" },
      { title: "انتخاب گروهی", body: "در جدول موجودی چند کالا را تیک بزنید: «ورود کالا برای انتخاب‌شده‌ها» رسید را با همان کالاها باز می‌کند، و «خروجی CSV» فهرستشان را می‌دهد." },
      { title: "انبارگردانی", body: "«اصلاح موجودی» عدد شمارش‌شده را می‌گیرد و فقط اختلاف را ثبت می‌کند، با دلیل." },
      { title: "حداقل موجودی", body: "برای هر کالا حداقل تعیین کنید؛ کالاهای زیر حداقل موجودی در داشبورد و زنگ اعلان‌ها نشان داده می‌شوند." },
    ],
  },
  {
    id: "payments",
    title: "دریافت‌ها و چک‌ها",
    icon: HandCoins,
    intro: "مانده حساب هر مشتری = جمع فاکتورهای صادرشده − دریافت‌ها (بدون چک برگشتی و رسید باطل).",
    steps: [
      { title: "ثبت دریافت", body: "نوع دریافت: نقد، کارتخوان، حواله بانکی یا چک. برای چک، شماره، بانک و سررسید لازم است." },
      { title: "پیگیری چک‌ها", body: "در زبانه‌ی «چک‌ها»، چک‌ها به ترتیب سررسید هستند. از منوی ردیف «وصول شد» یا «برگشت خورد» را بزنید. چک‌هایی که تا یک هفته سررسید می‌شوند در زنگ اعلان‌ها می‌آیند.", to: "/payments?tab=cheques", linkText: "چک‌ها" },
      { title: "مانده حساب‌ها", body: "زبانه‌ی «مانده حساب مشتریان» بدهکاران را به ترتیب بدهی نشان می‌دهد.", to: "/payments?tab=balances", linkText: "مانده حساب‌ها" },
    ],
  },
  {
    id: "reports",
    title: "گزارش و سپیدار",
    icon: ChartColumn,
    intro: "گزارش‌ها فقط اسناد صادرشده را می‌شمارند.",
    steps: [
      { title: "گزارش فروش", body: "فروش، سود ناخالص، وصولی، مشتریان و کالاهای برتر، و فهرست پیش‌فاکتورهای باز و فاکتورهای بدون حواله. «خروجی اکسل» همین گزارش را فایل می‌کند.", to: "/reports", linkText: "گزارش فروش" },
      { title: "انتقال به سپیدار", body: "هر ماه از «تبادل با سپیدار» بازه را انتخاب و فایل‌ها را به ترتیب دانلود کنید: طرف حساب‌ها و کالاها، رسید انبار، فاکتورها، دریافت‌ها. مبالغ ریال و تاریخ‌ها شمسی است.", to: "/exchange", linkText: "تبادل با سپیدار" },
      { title: "پشتیبان", body: "مدیر سیستم در همان صفحه پشتیبان کامل (JSON) می‌گیرد. هفته‌ای یک بار توصیه می‌شود." },
    ],
  },
  {
    id: "fixes",
    title: "ابطال و اصلاح",
    icon: Ban,
    intro: "برای حفظ سابقه، هیچ سند صادرشده‌ای پاک نمی‌شود.",
    steps: [
      { title: "پیش‌نویس", body: "آزادانه ویرایش یا حذف می‌شود." },
      { title: "سند صادرشده", body: "«ابطال سند» با دلیل. ترتیب ابطال برعکس ساخت است: اول حواله، بعد دریافت‌های فاکتور، بعد فاکتور، بعد پیش‌فاکتور. ابطال حواله کالا را به انبار برمی‌گرداند." },
      { title: "رسید دریافت اشتباه", body: "از منوی ردیف «ابطال رسید»؛ از مانده حساب خارج می‌شود." },
      { title: "برگشت از فروش", body: "بخش مستقل آن به‌زودی اضافه می‌شود. تا آن زمان راهنمای صفحه‌ی «برگشت از فروش» را ببینید.", to: "/returns", linkText: "برگشت از فروش" },
    ],
  },
];

const ROLES: { role: string; icon: LucideIcon; does: string }[] = [
  { role: "فروش", icon: Contact, does: "طرف حساب، پیش‌فاکتور، فاکتور؛ مشاهده‌ی دریافت‌ها" },
  { role: "انبار", icon: PackagePlus, does: "ورود کالا، انبارگردانی، حواله خروج" },
  { role: "حسابداری", icon: HandCoins, does: "دریافت و چک، گزارش‌ها، خروجی سپیدار" },
  { role: "مدیر سیستم", icon: Users, does: "همه‌چیز، به‌علاوه‌ی کاربران، اطلاعات شرکت و پشتیبان" },
];

const SHORTCUTS: [string[], string][] = [
  [["Ctrl", "K"], "جستجو و دستورات"],
  [["G", "D"], "داشبورد"],
  [["G", "S"], "پیش‌فاکتورها"],
  [["G", "F"], "فاکتورها"],
  [["G", "I"], "انبار"],
  [["G", "M"], "دریافت‌ها"],
  [["N", "P"], "پیش‌فاکتور جدید"],
  [["N", "I"], "فاکتور جدید"],
];

export function GuidePage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <AppShell title="راهنمای کار">
      <div className="mx-auto grid max-w-6xl gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-6">
          <section className={cn("space-y-2", REVEAL)}>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">روند کار با سامانه</h2>
            <p className="text-sm text-muted-foreground">
              از پیش‌فاکتور تا سپیدار، هر مرحله کجاست و چه کسی انجامش می‌دهد. روی هر مرحله بزنید تا به همان صفحه بروید.
            </p>
          </section>

          {/* The main flow as a row of steps (wraps on phones). */}
          <Card className={REVEAL} style={stagger(1)}>
            <CardContent>
              <ol className="flex flex-wrap items-stretch gap-2">
                {FLOW.map((step, i) => (
                  <Fragment key={step.label}>
                    <li className="min-w-28 flex-1">
                      <Link
                        to={step.to}
                        className="group flex h-full flex-col items-center gap-2 rounded-lg border bg-background p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-4.5">
                          {step.icon}
                        </span>
                        <span className="text-sm font-medium">
                          <span className="me-1 text-muted-foreground tabular-nums">{i + 1}.</span>
                          {step.label}
                        </span>
                        <Badge variant="outline" className="text-[11px] font-normal">{step.who}</Badge>
                      </Link>
                    </li>
                    {i < FLOW.length - 1 && (
                      <li aria-hidden className="hidden items-center text-muted-foreground sm:flex">
                        <ArrowLeft className="size-4" />
                      </li>
                    )}
                  </Fragment>
                ))}
              </ol>
            </CardContent>
          </Card>

          {SECTIONS.map((section, si) => (
            <Card key={section.id} id={section.id} className={cn("scroll-mt-20", REVEAL)} style={stagger(si + 2)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="size-5 text-primary" /> {section.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{section.intro}</p>
              </CardHeader>
              <CardContent>
                <ol className="relative space-y-4 border-s ps-6">
                  {section.steps.map((step, i) => (
                    <li key={step.title} className="relative">
                      <span className="absolute -start-[2.05rem] top-0 flex size-5 items-center justify-center rounded-full border bg-background text-[11px] font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <h4 className="font-medium">{step.title}</h4>
                      <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{step.body}</p>
                      {step.to && (
                        <Link to={step.to} className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                          {step.linkText} <ArrowLeft className="size-3.5" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5 text-primary" /> چه کسی چه می‌کند
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {ROLES.map((r) => (
                    <li key={r.role} className="flex items-start gap-2">
                      <r.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>
                        <b>{r.role}:</b> <span className="text-muted-foreground">{r.does}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card id="shortcuts" className="scroll-mt-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="size-5 text-primary" /> میانبرهای صفحه‌کلید
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {SHORTCUTS.map(([keys, label]) => (
                    <li key={label} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span dir="ltr" className="flex gap-1">
                        {keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">با صفحه‌کلید فارسی هم کار می‌کنند.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Table of contents */}
        <nav aria-label="فهرست راهنما" className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+1.5rem)] space-y-1 text-sm">
            <p className="mb-2 font-semibold">در این صفحه</p>
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <s.icon className="size-4" /> {s.title}
              </a>
            ))}
            <a href="#shortcuts" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <Keyboard className="size-4" /> میانبرها
            </a>
            <Link to="/exchange" className="mt-3 flex items-center gap-2 rounded-md px-2 py-1.5 text-primary hover:bg-primary/5">
              <ArrowLeftRight className="size-4" /> تبادل با سپیدار
            </Link>
          </div>
        </nav>
      </div>
    </AppShell>
  );
}
