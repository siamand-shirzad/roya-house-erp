import {
  ArrowLeftRight,
  Building2,
  ChartColumn,
  Contact,
  FileClock,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Tags,
  Truck,
  Undo2,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

// One map of the app's sections, shared by the sidebar, the header
// breadcrumb and the quick-create menu, so a page is named the same way
// everywhere. Groups follow the flow of the business (and Sepidar's menus):
// sell → deliver from the warehouse → people → accounting → settings.

export type NavItem = {
  to: string;
  label: string;
  tooltip?: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Shown with a "soon" tag; the page explains what is planned. */
  soon?: boolean;
};
export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { label: "", items: [{ to: "/", label: "داشبورد", icon: LayoutDashboard, exact: true }] },
  {
    label: "فروش",
    items: [
      { to: "/documents/proforma", label: "پیش‌فاکتورها", icon: FileClock },
      { to: "/documents/invoice", label: "فاکتورهای فروش", icon: ReceiptText },
      { to: "/payments", label: "دریافت‌ها و چک‌ها", tooltip: "دریافت وجه، چک و مانده حساب", icon: HandCoins },
      { to: "/returns", label: "برگشت از فروش", icon: Undo2, soon: true },
    ],
  },
  {
    label: "انبار و کالا",
    items: [
      { to: "/inventory", label: "موجودی و گردش", tooltip: "موجودی، ورود کالا و گردش", icon: Warehouse },
      { to: "/documents/goods-issue", label: "حواله‌های خروج", icon: Truck },
      { to: "/products", label: "کالاها و قیمت‌ها", icon: Tags },
    ],
  },
  {
    label: "اشخاص",
    items: [{ to: "/customers", label: "مشتریان و تأمین‌کنندگان", tooltip: "طرف حساب‌ها", icon: Contact }],
  },
  {
    label: "گزارش و حسابداری",
    items: [
      { to: "/reports", label: "گزارش فروش", tooltip: "فروش، سود و پیگیری", icon: ChartColumn },
      { to: "/exchange", label: "تبادل با سپیدار", tooltip: "خروجی سپیدار و پشتیبان", icon: ArrowLeftRight },
    ],
  },
  {
    label: "تنظیمات",
    items: [
      { to: "/users", label: "کاربران", icon: Users },
      { to: "/settings/company", label: "اطلاعات شرکت", tooltip: "مشخصات فروشنده روی اسناد", icon: Building2 },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label })));

/** The nav entry a path belongs to (longest matching prefix), with its group. */
export function navItemFor(pathname: string) {
  return ALL_ITEMS.filter((item) => (item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/") || pathname.startsWith(item.to + "?")))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

export type Crumb = { label: string; to?: string };

/**
 * Breadcrumb for the header: group › section › page. The page title is only
 * added when it says more than the section name (a document number, a
 * customer's name).
 */
export function breadcrumbFor(pathname: string, title: string): Crumb[] {
  const item = navItemFor(pathname);
  if (!item || item.to === "/") return [{ label: title }];
  const crumbs: Crumb[] = [];
  if (item.group) crumbs.push({ label: item.group });
  const isSectionRoot = pathname === item.to;
  crumbs.push(isSectionRoot ? { label: item.label } : { label: item.label, to: item.to });
  if (!isSectionRoot && title && title !== item.label) crumbs.push({ label: title });
  return crumbs;
}
