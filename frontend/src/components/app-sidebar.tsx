import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FileTextIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptIcon,
  TruckIcon,
} from "lucide-react";

import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { DOCUMENT_TYPE_LABELS } from "@/types";
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
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { to: "/", label: "داشبورد و فهرست کالاها", icon: LayoutDashboardIcon },
  {
    to: `/documents/${TYPE_TO_SLUG.PROFORMA}`,
    label: DOCUMENT_TYPE_LABELS.PROFORMA.title,
    icon: FileTextIcon,
  },
  {
    to: `/documents/${TYPE_TO_SLUG.INVOICE}`,
    label: DOCUMENT_TYPE_LABELS.INVOICE.title,
    icon: ReceiptIcon,
  },
  {
    to: `/documents/${TYPE_TO_SLUG.GOODS_ISSUE}`,
    label: DOCUMENT_TYPE_LABELS.GOODS_ISSUE.title,
    icon: TruckIcon,
  },
];

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <PackageIcon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">رویا هاوس</span>
                  <span className="text-xs text-sidebar-foreground/70">
                    سامانه فروش و انبار
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>منو</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.to === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(item.to)
                    }
                    tooltip={item.label}
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
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/60">
          سیستم های سقف کاذب و ساخت خشک
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
