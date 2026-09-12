import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toJalali, toDisplayDigits } from "@/lib/format";
import { CategoryIcon, DOCUMENT_TYPE_ICONS } from "@/lib/icons";
import { CATEGORY_LABELS, type ProductCategory } from "@/types";
import { SitePhoto } from "./SitePhoto";

// Public landing page for Roya House (route /site).
// Design dials: DESIGN_VARIANCE 5 / MOTION_INTENSITY 4 / VISUAL_DENSITY 5.
// Shape rule: surfaces (tiles, photos) use rounded-2xl; controls keep the
// shared shadcn radius. One accent: the brand --primary. Motion is hover/press
// feedback only (no entrance or scroll animation). All copy comes from the
// price list and the documents' real terms; don't add invented stats or claims.

// Hover motion: one easing curve, translate/scale/opacity only, and every
// movement behind `motion-safe:` so reduced-motion users get colour feedback only.
const EASE = "duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";
const LIFT = `transition ${EASE} motion-safe:hover:-translate-y-1`;
const BUTTON_MOTION = `${EASE} motion-safe:hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 motion-safe:active:scale-[0.98]`;

const PHONES = [
  { display: "0935 720 5000", href: "tel:+989357205000" },
  { display: "0935 611 5000", href: "tel:+989356115000" },
];

const ADDRESS =
  "تهران، چهاردانگه به آزادگان شرق، خیابان غفاری، خیابان عرفان، عرفان یکم غربی، پلاک 105";

const CONTACT_LABEL = "تماس با فروش";

const BRANDS = ["بانا", "مگابرد", "یزد", "باتیس", "جی‌برد", "کارویم", "گرندکس", "بردکس"];

type Tone = "plain" | "tint" | "accent";

type Tile = {
  category: ProductCategory;
  blurb: string;
  tone: Tone;
  className: string;
  photo?: { src: string; alt: string; slot: string };
  layout?: "stacked" | "split";
};

// 4-column bento, 16 slots filled exactly:
// [panel 2x2][structure 2x1] / [tile][brand] / [screw 2][spri][tape] / [connector 2][other 2]
const TILES: Tile[] = [
  {
    category: "GYPSUM_PANEL",
    blurb: "معمولی، ضد رطوبت (MR)، مقاوم در برابر آتش (FR) و ضخیم 15 میلی‌متری",
    tone: "plain",
    className: "md:col-span-2 lg:row-span-2",
    photo: { src: "/site/gypsum-panels.jpg", alt: "بسته‌های پنل گچی در انبار", slot: "پنل‌های گچی" },
    layout: "stacked",
  },
  {
    category: "METAL_STRUCTURE",
    blurb: "پروفیل F47 و U36، نبشی، استاد و رانر در ضخامت‌های مختلف",
    tone: "plain",
    className: "md:col-span-2",
    photo: { src: "/site/metal-structure.jpg", alt: "شاخه‌های سازه فلزی سقف کاذب", slot: "سازه فلزی" },
    layout: "split",
  },
  {
    category: "GYPSUM_TILE",
    blurb: "تایل سفید ساده، حصیری، تخم‌مرغی و پانچ",
    tone: "tint",
    className: "",
  },
  {
    category: "BRAND_PANEL",
    blurb: "پنل‌های RG، MR و FR از برندهای شناخته‌شده",
    tone: "accent",
    className: "",
  },
  {
    category: "SCREW_BOLT",
    blurb: "پیچ پانل و سازه، آویز سقفی، رابط و میخ چاشنی",
    tone: "plain",
    className: "md:col-span-2",
  },
  { category: "SPRI_ACCESSORY", blurb: "سپری فیکس در طول‌های مختلف", tone: "plain", className: "" },
  { category: "TAPE_PUTTY", blurb: "نوار درزگیر کاغذی و بتونه درزگیر", tone: "plain", className: "" },
  {
    category: "CONNECTOR",
    blurb: "کلیپس، براکت و اتصال‌های W و HT90",
    tone: "tint",
    className: "lg:col-span-2",
  },
  {
    category: "OTHER",
    blurb: "پشم سنگ، نوار کی‌پلاس و پودر بتونه",
    tone: "plain",
    className: "lg:col-span-2",
  },
];

const STEPS = [
  {
    icon: PhoneCall,
    title: "استعلام قیمت روز",
    body: "با فروش تماس بگیرید یا فهرست اقلام موردنیازتان را بفرستید.",
  },
  {
    icon: DOCUMENT_TYPE_ICONS.PROFORMA,
    title: "پیش‌فاکتور رسمی",
    body: "پیش‌فاکتور با مشخصات کامل صادر می‌شود و 24 ساعت اعتبار دارد.",
  },
  {
    icon: DOCUMENT_TYPE_ICONS.GOODS_ISSUE,
    title: "بارگیری از انبار",
    body: "با واریز پیش‌پرداخت، سفارش تأیید و با حواله خروج از انبار بارگیری می‌شود.",
  },
];

const TONE_CLASSES: Record<Tone, { tile: string; muted: string; icon: string }> = {
  plain: {
    tile: "border bg-card text-card-foreground hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10",
    muted: "text-muted-foreground",
    icon: "bg-primary/10 text-primary",
  },
  tint: {
    tile: "border border-primary/20 bg-primary/10 text-foreground hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10",
    // muted-foreground is only ~4.1:1 on the tint in light mode; this keeps AA.
    muted: "text-foreground/75",
    // A primary tint on top of the tile's own primary tint barely reads, so
    // the badge lifts back to the page background instead.
    icon: "bg-background/70 text-primary",
  },
  accent: {
    tile: "bg-primary text-primary-foreground hover:shadow-xl hover:shadow-primary/30",
    muted: "text-primary-foreground/80",
    icon: "bg-primary-foreground/15 text-primary-foreground",
  },
};

// Live item counts per category from the public (unauthenticated) catalog
// endpoint, which exposes counts only, never prices. Failures hide the counts.
function useCategoryCounts() {
  const [counts, setCounts] = useState<Partial<Record<ProductCategory, number>> | null>(null);

  useEffect(() => {
    api.public
      .catalog()
      .then((rows) => setCounts(Object.fromEntries(rows.map((r) => [r.category, r.count]))))
      .catch(() => setCounts(null));
  }, []);

  return counts;
}

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 md:py-24", className)}>
      <div className="mx-auto max-w-7xl px-4 lg:px-8">{children}</div>
    </section>
  );
}

function SectionHeading({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-10 max-w-[65ch] space-y-3">
      <h2 className="text-3xl font-extrabold leading-[1.4] md:text-4xl">{title}</h2>
      {body && <p className="text-base leading-8 text-muted-foreground">{body}</p>}
    </div>
  );
}

function CategoryTile({ tile, count }: { tile: Tile; count: number | undefined }) {
  const tone = TONE_CLASSES[tile.tone];
  const text = (
    <div className="flex flex-col gap-2 p-6">
      <div
        className={cn(
          "mb-1 flex size-12 items-center justify-center rounded-xl",
          tone.icon
        )}
      >
        <CategoryIcon category={tile.category} className="size-6" />
      </div>
      <h3 className="text-lg font-bold leading-8">{CATEGORY_LABELS[tile.category]}</h3>
      <p className={cn("text-sm leading-7", tone.muted)}>{tile.blurb}</p>
      {count !== undefined && (
        <p className={cn("mt-auto pt-2 text-sm font-medium tabular-nums", tone.muted)}>
          {toDisplayDigits(count)} قلم کالا
        </p>
      )}
    </div>
  );

  return (
    <article
      className={cn(
        "group flex overflow-hidden rounded-2xl",
        LIFT,
        // Split tiles: text first in reading order (right), photo on the left.
        tile.layout === "stacked" ? "flex-col" : "flex-col md:flex-row-reverse",
        tone.tile,
        tile.className
      )}
    >
      {tile.photo && (
        <SitePhoto
          {...tile.photo}
          className={cn(
            "w-full transition duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.04]",
            tile.layout === "stacked"
              ? "aspect-[4/3] md:aspect-[16/9] lg:aspect-auto lg:min-h-0 lg:flex-1"
              : "aspect-[16/9] md:aspect-auto md:w-1/2 md:self-stretch"
          )}
        />
      )}
      <div className={cn("flex flex-1 flex-col", tile.layout === "split" && "md:w-1/2")}>{text}</div>
    </article>
  );
}

export function LandingPage() {
  const counts = useCategoryCounts();
  const year = toDisplayDigits(toJalali(new Date()).jy);

  useEffect(() => {
    const previous = document.title;
    document.title = "رویا هاوس | مصالح سقف کاذب و ساخت خشک";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 lg:px-8">
          <a href="#top" className="flex shrink-0 items-center gap-3" aria-label="رویا هاوس، بازگشت به بالا">
            <BrandLogo className="h-11 shrink-0" />
            <span className="hidden text-lg font-extrabold sm:inline">رویا هاوس</span>
          </a>
          <nav aria-label="بخش‌های صفحه" className="hidden items-center gap-1 text-sm md:flex">
            {[
              ["#products", "محصولات"],
              ["#brands", "برندها"],
              ["#order", "نحوه سفارش"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={cn(
                  "relative rounded-md px-3 py-2 text-muted-foreground transition-colors hover:text-foreground",
                  // Underline grows from the reading start (right).
                  "after:absolute after:inset-x-3 after:bottom-1 after:h-0.5 after:origin-right after:scale-x-0 after:rounded-full after:bg-primary after:transition after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)] hover:after:scale-x-100 motion-reduce:after:transition-none"
                )}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild size="sm" className={BUTTON_MOTION}>
              <a href="#contact">
                <Phone /> {CONTACT_LABEL}
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: asymmetric split, text at the reading start (right in RTL). */}
        <section id="top" className="scroll-mt-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-16 md:pb-24 lg:gap-16 lg:px-8 lg:pt-20">
            <div className="space-y-6">
              <h1 className="text-4xl font-extrabold leading-[1.35] md:text-5xl lg:text-6xl">
                مصالح ساخت خشک، <span className="inline-block text-primary">از پنل تا پیچ</span>
              </h1>
              <p className="max-w-[46ch] text-lg leading-9 text-muted-foreground">
                پنل گچی، سازه فلزی، تایل و اتصالات را یک‌جا از انبار رویا هاوس در تهران تهیه کنید.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg" className={BUTTON_MOTION}>
                  <a href="#contact">
                    <Phone /> {CONTACT_LABEL}
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className={cn("group", BUTTON_MOTION, "hover:shadow-md hover:shadow-foreground/5")}>
                  <a href="#products">
                    مشاهده محصولات
                    <ArrowLeft className={cn("transition", EASE, "motion-safe:group-hover:-translate-x-1")} />
                  </a>
                </Button>
              </div>
            </div>
            <SitePhoto
              src="/site/hero.jpg"
              alt="انبار رویا هاوس با پنل‌های گچی و سازه‌های فلزی"
              slot="تصویر اصلی (انبار یا سقف اجراشده)"
              priority
              className="aspect-[4/3] w-full rounded-2xl md:aspect-[5/4]"
            />
          </div>
        </section>

        <Section id="products" className="border-t bg-muted/30">
          <SectionHeading
            title="محصولات"
            body="همه‌ی اقلام لیست قیمت رویا هاوس، از پنل و سازه تا پیچ، نوار و بتونه."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[repeat(4,minmax(11rem,auto))]">
            {TILES.map((tile) => (
              <CategoryTile key={tile.category} tile={tile} count={counts?.[tile.category]} />
            ))}
          </div>
        </Section>

        <Section id="brands">
          <SectionHeading
            title="برندهای پنل گچی"
            body="پنل‌های معمولی (RG)، ضد رطوبت (MR) و مقاوم در برابر آتش (FR) از این برندها عرضه می‌شود."
          />
          <ul className="grid grid-cols-2 border-t border-s sm:grid-cols-4">
            {BRANDS.map((brand) => (
              <li
                key={brand}
                className="group flex h-24 items-center justify-center border-e border-b px-4 text-2xl font-bold text-foreground/80 transition-colors hover:bg-primary/5 md:h-28 md:text-3xl"
              >
                {/* Move the name, not the cell, so the grid lines stay put. */}
                <span className={cn("transition", EASE, "group-hover:text-primary motion-safe:group-hover:-translate-y-1")}>
                  {brand}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="order" className="border-t bg-muted/30">
          <SectionHeading title="نحوه سفارش" />
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="group relative flex gap-5 md:flex-col md:gap-5">
                {/* Segment to the next step: down the icon column on mobile, across to the next icon on desktop. */}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-12 -bottom-10 right-6 w-px bg-border md:top-6 md:right-12 md:-left-8 md:bottom-auto md:h-px md:w-auto"
                  />
                )}
                <span
                  className={cn(
                    "relative flex size-12 shrink-0 items-center justify-center rounded-full border bg-background text-primary transition",
                    EASE,
                    "group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground motion-safe:group-hover:scale-110"
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <div className="space-y-2 pt-2 md:pt-0">
                  <h3 className="text-lg font-bold leading-8">{title}</h3>
                  <p className="max-w-[40ch] text-sm leading-7 text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* Contact: stacked CTA band (the hero already uses the text/photo split). */}
        <Section id="contact">
          <div className="rounded-2xl border bg-card px-6 py-10 md:px-12 md:py-14">
            <SectionHeading
              title="تماس با رویا هاوس"
              body="برای استعلام قیمت روز و ثبت سفارش با واحد فروش تماس بگیرید."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
              {PHONES.map((phone) => (
                <a
                  key={phone.href}
                  href={phone.href}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border bg-background p-4",
                    LIFT,
                    "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 motion-safe:active:scale-[0.99]"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition",
                      EASE,
                      "group-hover:bg-primary group-hover:text-primary-foreground"
                    )}
                  >
                    <Phone className="size-5" />
                  </span>
                  <span dir="ltr" className="text-2xl font-bold tabular-nums group-hover:text-primary">
                    {phone.display}
                  </span>
                </a>
              ))}
            </div>
            <div className="mt-8 flex items-start gap-3 border-t pt-6">
              <MapPin className="mt-1.5 size-5 shrink-0 text-muted-foreground" />
              <address className="text-sm not-italic leading-7 text-muted-foreground">{ADDRESS}</address>
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <span className="font-bold text-foreground">رویا هاوس</span>
            <span className="ms-2">سیستم‌های سقف کاذب و ساخت خشک</span>
          </div>
          <div className="flex items-center gap-6">
            <span>© {year} رویا هاوس</span>
            <Link to="/" className="underline-offset-4 hover:text-foreground hover:underline">
              ورود به سامانه
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
