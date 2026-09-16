import type { NextFunction, Request, Response } from "express";

export const MODULES = ["dashboard", "proforma", "invoice", "goods_issue", "products", "customers", "inventory", "payments", "reports", "company"] as const;
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
  if (module === "payments") return user.role === "ACCOUNTANT" ? "edit" : user.role === "SALES" ? "view" : "none";
  if ((module === "proforma" || module === "invoice" || module === "customers") && user.role === "SALES") return "edit";
  if ((module === "inventory" || module === "goods_issue") && user.role === "WAREHOUSE") return "edit";
  return "view";
}
export function can(user: Principal, module: Module, edit = false) {
  const level = accessFor(user, module);
  return edit ? level === "edit" : level !== "none";
}
export function requirePermission(module: Module) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user) return res.status(401).json({ error: "Not signed in" });
    if (!can(res.locals.user, module, !["GET", "HEAD"].includes(req.method))) return res.status(403).json({ error: "Access to this section is not allowed" });
    next();
  };
}
