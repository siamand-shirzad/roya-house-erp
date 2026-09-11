import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) md:rounded-t-xl">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-mr-1" />
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="truncate text-base font-semibold">{title}</h1>
        <div className="mr-auto flex items-center gap-1.5">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
