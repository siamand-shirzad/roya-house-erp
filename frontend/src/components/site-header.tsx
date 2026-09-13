import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

// Where "back" goes when there's no in-app history to return to (a page
// opened from a bookmark or a pasted link): a document goes to its type's
// list, everything else to the dashboard.
function parentPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "documents" && parts.length >= 3) return `/documents/${parts[1]}`;
  return "/";
}

function BackButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  if (pathname === "/") return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 motion-safe:hover:translate-x-0.5"
      aria-label="بازگشت"
      title="بازگشت"
      onClick={() => {
        // react-router keeps its own history index; 0 means this is the first page of the visit.
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) navigate(-1);
        else navigate(parentPath(pathname));
      }}
    >
      {/* RTL: "back" points right. */}
      <ArrowRight />
    </Button>
  );
}

export function SiteHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) md:rounded-t-xl">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-mr-1" />
        <BackButton />
        {/* On mobile the sidebar (and its logo) is hidden behind the trigger.
            md:hidden sits on a wrapper: on the <img> it would lose to dark:block. */}
        <span className="md:hidden">
          <BrandLogo className="h-8" />
        </span>
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
