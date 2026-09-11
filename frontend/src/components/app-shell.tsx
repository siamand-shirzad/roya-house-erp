import { useState, type CSSProperties, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";

const SIDEBAR_KEY = "roya-sidebar-open";

function readSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== "false";
  } catch {
    return true;
  }
}

// Shared chrome for every ERP page: collapsible-to-icons sidebar (sidebar-07)
// + sticky header. The expanded/collapsed choice is remembered per browser.
export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(readSidebarOpen);

  return (
    <SidebarProvider
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        try {
          localStorage.setItem(SIDEBAR_KEY, String(value));
        } catch {
          // Not persisted; fine.
        }
      }}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={title} actions={actions} />
        <div className="@container/main flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
