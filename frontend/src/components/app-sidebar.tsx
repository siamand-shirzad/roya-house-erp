import { canAccessPath } from "@/lib/permissions";
import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Command } from "lucide-react";

import { useCommandMenu } from "@/components/command-menu";


import { LogoMark } from "@/components/logo-mark";
import { Badge } from "@/components/ui/badge";
import { NAV, type NavItem } from "@/lib/navigation";
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
  useSidebar,
} from "@/components/ui/sidebar";


// Layout from the shadcn sidebar-07 block: collapses to an icon rail (always
// partly visible), brand at the top, the guide at the bottom (the signed-in
// user moved to the header). Sections come from lib/navigation.ts.

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const { open: openCommandMenu } = useCommandMenu();
  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="رویا هاوس">
              <Link to="/" aria-label="رویا هاوس">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
                  <LogoMark className="h-6 w-auto text-sidebar-foreground" />
                </span>
                <div className="grid flex-1 text-right leading-tight group-data-[collapsible=icon]:hidden">
                  <span dir="ltr" className="truncate text-right font-display text-[15px] font-semibold tracking-tight">
                    رویا هاوس
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">سامانه فروش و انبار</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* Persian trigger; the command palette itself uses English labels. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={openCommandMenu}
              aria-label="جستجو و دستورات"
              tooltip="جستجو و دستورات"
              className="h-9 border border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Command />
              <span className="text-sm group-data-[collapsible=icon]:hidden">
                جستجو
              </span>
              <kbd
                dir="ltr"
                className="ms-auto rounded border border-sidebar-border px-1.5 font-display text-[10px] font-medium tracking-wider text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden"
              >
                ⌘ K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV.map((g) => ({...g, items:g.items.filter((item) => canAccessPath(user, item.to))})).filter((g) => g.items.length > 0).map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            {group.label && (
              <SidebarGroupLabel className="h-7 text-xs font-medium text-sidebar-foreground/45">
                {group.label}
              </SidebarGroupLabel>
            )}
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
                      <Link to={item.to} aria-label={item.label} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        {item.soon && (
                          <Badge variant="outline" className="ms-auto px-1.5 py-0 text-[10px] font-normal text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
                            به‌زودی
                          </Badge>
                        )}
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="راهنمای کار" isActive={location.pathname === "/guide"} className="h-9 text-sidebar-foreground/70">
              <Link to="/guide" onClick={() => setOpenMobile(false)}>
                <BookOpen />
                <span className="group-data-[collapsible=icon]:hidden">راهنمای کار</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
