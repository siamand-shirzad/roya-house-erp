import { Fragment, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft, Search } from "lucide-react";

import { useCommandMenu } from "@/components/command-menu";
import { HeaderNotifications } from "@/components/header/header-notifications";
import { QuickCreate } from "@/components/header/quick-create";
import { LogoMark } from "@/components/logo-mark";
import { NavUser } from "@/components/nav-user";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { breadcrumbFor } from "@/lib/navigation";
import { cn } from "@/lib/utils";

// Header layout (after the studio-admin dashboards):
//   start: sidebar toggle · back · breadcrumb (group › section › page)
//   end:   page actions · search · quick create · alerts · theme · user
// Below xl search and quick create are icons; below md the breadcrumb shrinks
// to the page title and the theme choice lives in the user menu.

// Where "back" goes when there's no in-app history to return to (a page
// opened from a bookmark or a pasted link): a document goes to its type's
// list, everything else to the dashboard.
function parentPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "documents" && parts.length >= 3) return `/documents/${parts[1]}`;
  if (parts[0] === "customers" && parts.length >= 2) return "/customers";
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

function Breadcrumb({ title }: { title: string }) {
  const { pathname } = useLocation();
  const crumbs = breadcrumbFor(pathname, title);
  const last = crumbs[crumbs.length - 1];
  return (
    <nav aria-label="مسیر صفحه" className="min-w-0 flex-1 md:flex-none md:shrink">
      {/* Phones: just the page. */}
      <h1 className="truncate text-base font-semibold md:hidden">{last.label}</h1>
      <ol className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              <li className={isLast ? "min-w-0" : "shrink-0"}>
                {isLast ? (
                  <h1 className="truncate text-base font-semibold" aria-current="page">
                    {c.label}
                  </h1>
                ) : c.to ? (
                  <Link to={c.to} className="text-muted-foreground transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{c.label}</span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden className="text-muted-foreground/60">
                  <ChevronLeft className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function SearchButton() {
  const { open } = useCommandMenu();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={open}
        className="hidden w-44 justify-start gap-2 text-muted-foreground xl:inline-flex"
        aria-label="جستجو و دستورات"
      >
        <Search />
        <span className="flex-1 text-start">جستجو...</span>
        <kbd dir="ltr" className="rounded border px-1.5 font-display text-[10px] tracking-wider">
          Ctrl K
        </kbd>
      </Button>
      <Button variant="ghost" size="icon" onClick={open} className="size-8 xl:hidden" aria-label="جستجو و دستورات">
        <Search />
      </Button>
    </>
  );
}

export function SiteHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    // Floating bar, like the sidebar: a card inset to the same gutter as the
    // page content. The solid strip above it hides content scrolling past.
    <header className="sticky top-0 z-20 shrink-0 bg-transparent px-2 pt-1 md:px-6 md:pt-2">
      <div className="flex h-11 w-full items-center gap-0.5 rounded-xl border bg-card/65 px-1.5 shadow-card backdrop-blur-xl supports-[backdrop-filter]:bg-card/55 md:h-(--header-height) md:gap-1 lg:gap-2 lg:px-3">
        <SidebarTrigger className="-mr-1" />
        <BackButton />
        {/* On mobile the sidebar (and its mark) is hidden behind the trigger. */}
        <LogoMark className="h-6 w-auto shrink-0 text-foreground md:hidden" />
        <Separator orientation="vertical" className="mx-1.5 hidden h-4 md:block" />
        <Breadcrumb title={title} />
        {/* Page actions sit before the shared icons on wide screens and wrap
            onto their own row on phones. */}
        {actions && (
          <div className="order-1 ms-auto flex shrink-0 items-center gap-1 border-e pe-1 max-sm:[&>*:not(:first-child)]:hidden max-sm:[&_button]:size-8 max-sm:[&_button]:overflow-hidden max-sm:[&_button]:px-0 max-sm:[&_button]:text-[0px] md:w-auto md:gap-1.5 md:pe-2">
            {actions}
          </div>
        )}
        <div className={cn("order-1 ms-auto flex shrink-0 items-center gap-0.5 md:order-2 md:gap-1", actions && "md:ms-0")}>
          <SearchButton />
          <span className="hidden xl:contents">
            <QuickCreate />
          </span>
          <span className="contents xl:hidden">
            <QuickCreate compact />
          </span>
          <span className="hidden sm:contents"><HeaderNotifications /></span>
          <span className="hidden md:contents">
            <ThemeToggle />
          </span>
          <span className="hidden sm:contents"><NavUser /></span>
        </div>
      </div>
    </header>
  );
}
