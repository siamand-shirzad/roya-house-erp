export const MODULES = ["dashboard", "proforma", "invoice", "goods_issue", "products", "customers", "inventory", "reports", "company"] as const;
export type Module = typeof MODULES[number];
export type Access = "none" | "view" | "edit";
export type Permissions = Partial<Record<Module, Access>>;
type Principal = { role: string; permissions?: Permissions } | null | undefined;

export function accessFor(user: Principal, module: Module): Access {
  if (!user) return "none";
  if (user.role === "ADMIN") return "edit";
  if (user.permissions?.[module]) return user.permissions[module]!;
  if (module === "company") return "none";
  if (module === "reports") return user.role === "ACCOUNTANT" ? "view" : "none";
  if ((module === "proforma" || module === "invoice" || module === "customers") && user.role === "SALES") return "edit";
  if ((module === "inventory" || module === "goods_issue") && user.role === "WAREHOUSE") return "edit";
  return "view";
}
export function can(user: Principal, module: Module, edit = false) {
  const level = accessFor(user, module);
  return edit ? level === "edit" : level !== "none";
}

export const MODULE_LABELS: Record<Module, string> = { dashboard:"داشبورد", proforma:"پیش‌فاکتورها", invoice:"فاکتورها", goods_issue:"حواله خروج", products:"کالاها و قیمت‌ها", customers:"مشتریان", inventory:"انبار", reports:"گزارشات", company:"اطلاعات شرکت" };
export function moduleForPath(path: string): Module | "users" | undefined {
  if (path === "/") return "dashboard";
  if (path.startsWith("/documents/")) { const slug = path.split("/")[2]; return ({proforma:"proforma",invoice:"invoice","goods-issue":"goods_issue"} as Record<string,Module>)[slug]; }
  if (path.startsWith("/settings/company")) return "company";
  return (["products","customers","inventory","reports","users"] as const).find((module) => path.startsWith("/" + module));
}
export function canAccessPath(user: Principal, path: string) {
  const module = moduleForPath(path);
  return module === "users" ? user?.role === "ADMIN" : module ? can(user, module, path.endsWith("/new")) : true;
}
export const FIRST_PATHS = ["/", "/documents/proforma", "/documents/invoice", "/documents/goods-issue", "/products", "/customers", "/inventory", "/reports", "/settings/company"];
