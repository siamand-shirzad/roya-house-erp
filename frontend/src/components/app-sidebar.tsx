import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChartColumn, Contact, FileStack, LayoutDashboard, Tags, Users, type LucideIcon } from "lucide-react";

import { LogoMark } from "@/components/logo-mark";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/components/auth-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { REPORT_ROLES, type UserRole } from "@/types";

// Layout from the shadcn sidebar-07 block: collapses to an icon rail (always
// partly visible), brand at the top, signed-in user at the bottom. Group
// labels use the Latin display font; item labels are short Persian names with
// the full name as the collapsed-state tooltip.

type NavItem = { to: string; label: string; tooltip?: string; icon: LucideIcon; exact?: boolean };
type NavGroup = { label: string; items: NavItem[]; roles?: UserRole[] };

const NAV: NavGroup[] = [
  { label: "Overview", items: [{ to: "/", label: "داشبورد", icon: LayoutDashboard, exact: true }] },
  {
    label: "Documents",
    items: [
      {
        to: "/documents/proforma",
        label: "اسناد",
        tooltip: "پیش‌فاکتور، فاکتور و حواله خروج",
        icon: FileStack,
      },
    ],
  },
  {
    label: "Insights",
    roles: REPORT_ROLES,
    items: [{ to: "/reports", label: "گزارشات", tooltip: "گزارش فروش و پیگیری", icon: ChartColumn }],
  },
  {
    label: "Catalog",
    items: [
      { to: "/products", label: "کالاها و قیمت‌ها", icon: Tags },
      { to: "/customers", label: "مشتریان", tooltip: "فهرست مشتریان", icon: Contact },
    ],
  },
  { label: "Admin", roles: ["ADMIN"], items: [{ to: "/users", label: "کاربران", icon: Users }] },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { user } = useAuth();
  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.to
      : item.to.startsWith("/documents/")
        ? location.pathname.startsWith("/documents")
        : location.pathname.startsWith(item.to);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="رویا هاوس">
              <Link to="/">
                <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent">
                  <LogoMark onDark className="size-7" />
                </span>
                <div className="grid flex-1 text-right leading-tight">
                  <span dir="ltr" className="truncate text-right font-display text-[15px] font-semibold tracking-tight">
                    Roya House
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">سامانه فروش و انبار</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
        {NAV.filter((g) => !g.roles || (user && g.roles.includes(user.role))).map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="h-7 font-display text-[11px] font-semibold tracking-[0.14em] uppercase text-sidebar-foreground/45">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item)}
                      tooltip={item.tooltip ?? item.label}
                      className="h-9 text-[14px] data-[active=true]:bg-sidebar-accent data-[active=true]:[&>svg]:text-sidebar-primary"
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
