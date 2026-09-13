import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Contact, FileStack, LayoutDashboard, Monitor, Moon, Search, Sun, Tags, Users, type LucideIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Kbd } from "@/components/kbd";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import { TYPE_TO_SLUG } from "@/lib/documentTypeSlug";
import { formatJalaliDate, toDisplayDigits } from "@/lib/format";
import { CategoryIcon, DocumentTypeIcon } from "@/lib/icons";
import { matchesSearch } from "@/lib/search";
import { CATEGORY_LABELS, DOCUMENT_TYPE_LABELS, DOCUMENT_WRITE_ROLES, type Document, type DocumentType, type Product } from "@/types";

// Command palette (Ctrl+K / ⌘K, or "/") plus two-key shortcuts ("G D", "N P").
// Shortcuts match on KeyboardEvent.code - the physical key - so they work the
// same with a Persian keyboard layout active, where "g" types "گ".

type Shortcut = {
  id: string;
  keys: [string, string]; // e.g. ["G", "D"]
  label: string;
  icon: ReactNode;
  run: () => void;
};

const CommandMenuContext = createContext<{ open: () => void } | null>(null);

export function useCommandMenu() {
  return useContext(CommandMenuContext) ?? { open: () => undefined };
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  // Don't steal keys from fields, or from dialogs/menus that handle their own keyboard.
  return !!el.closest(
    'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'
  );
}

export function CommandMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const shortcuts = useMemo<Shortcut[]>(() => {
    if (!user) return [];
    const nav = (id: string, keys: [string, string], label: string, Icon: LucideIcon, to: string): Shortcut => ({
      id,
      keys,
      label,
      icon: <Icon />,
      run: () => navigate(to),
    });
    const list: Shortcut[] = [
      nav("go-dashboard", ["G", "D"], "داشبورد", LayoutDashboard, "/"),
      nav("go-documents", ["G", "S"], "اسناد", FileStack, "/documents/proforma"),
      nav("go-products", ["G", "P"], "کالاها و قیمت‌ها", Tags, "/products"),
      nav("go-customers", ["G", "C"], "مشتریان", Contact, "/customers"),
    ];
    if (user.role === "ADMIN") list.push(nav("go-users", ["G", "U"], "کاربران", Users, "/users"));

    const create: [DocumentType, string, string][] = [
      ["PROFORMA", "P", "پیش‌فاکتور جدید"],
      ["INVOICE", "I", "فاکتور جدید"],
      ["GOODS_ISSUE", "G", "حواله خروج جدید"],
    ];
    for (const [type, key, label] of create) {
      if (!DOCUMENT_WRITE_ROLES[type].includes(user.role)) continue;
      list.push({
        id: `new-${type}`,
        keys: ["N", key],
        label,
        icon: <DocumentTypeIcon type={type} />,
        run: () => navigate(`/documents/${TYPE_TO_SLUG[type]}/new`),
      });
    }
    return list;
  }, [user, navigate]);

  // Keep the key listener stable while always seeing the latest shortcuts.
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!user) return;
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;

      if (e.code === "Slash") {
        // "/" and "?" (Shift+/) both open the palette, which lists every shortcut.
        e.preventDefault();
        setOpen(true);
        return;
      }

      const letter = e.code.startsWith("Key") ? e.code.slice(3) : null;
      if (!letter) return;

      if (prefix) {
        const match = shortcutsRef.current.find((s) => s.keys[0] === prefix && s.keys[1] === letter);
        prefix = null;
        clearTimeout(timer);
        if (match) {
          e.preventDefault();
          match.run();
        }
        return;
      }
      if (letter === "G" || letter === "N") {
        prefix = letter;
        timer = setTimeout(() => (prefix = null), 1200);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [user]);

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);

  return (
    <CommandMenuContext.Provider value={value}>
      {children}
      {user && <CommandMenu open={open} onOpenChange={setOpen} shortcuts={shortcuts} />}
    </CommandMenuContext.Provider>
  );
}

function CommandMenu({
  open,
  onOpenChange,
  shortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
}) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Fresh data every time the palette opens, so a document saved a minute ago shows up.
  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([api.documents.list().catch(() => []), api.products.list({ active: "true" }).catch(() => [])])
      .then(([docs, prods]) => {
        if (cancelled) return;
        setDocuments(docs);
        setProducts(prods);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const query = search.trim();
  const commands = shortcuts.filter((s) => matchesSearch(`${s.label} ${s.keys.join(" ")}`, query));
  const docMatches = query
    ? documents
        .filter((d) =>
          matchesSearch(
            `${DOCUMENT_TYPE_LABELS[d.type].short} ${DOCUMENT_TYPE_LABELS[d.type].title} ${d.number} ${d.buyerName ?? ""} ${d.customer?.name ?? ""}`,
            query
          )
        )
        .slice(0, 8)
    : [];
  const productMatches = query
    ? products.filter((p) => matchesSearch(`${p.name} ${p.code ?? ""} ${p.spec ?? ""}`, query)).slice(0, 6)
    : [];

  const themes: { value: typeof theme; label: string; icon: ReactNode }[] = [
    { value: "light", label: "پوسته‌ی روشن", icon: <Sun /> },
    { value: "dark", label: "پوسته‌ی تیره", icon: <Moon /> },
    { value: "system", label: "پوسته‌ی مطابق سیستم", icon: <Monitor /> },
  ];
  const themeMatches = themes.filter((t) => matchesSearch(`${t.label} theme`, query));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          aria-describedby={undefined}
          className="fixed top-[12%] left-1/2 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">جستجو و دستورات</DialogPrimitive.Title>
          {/* Filtering is done here, not by cmdk, so Persian digits and yeh/kaf variants match. */}
          <Command shouldFilter={false} className="[&_[data-slot=command-input-wrapper]]:h-12">
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="جستجوی سند، کالا یا دستور..."
            />
            <CommandList className="max-h-[min(420px,60vh)]">
              <CommandEmpty>{loading && query ? "در حال جستجو..." : "نتیجه‌ای پیدا نشد."}</CommandEmpty>

              {docMatches.length > 0 && (
                <CommandGroup heading="اسناد">
                  {docMatches.map((d) => (
                    <CommandItem
                      key={d.id}
                      value={`doc-${d.id}`}
                      onSelect={() => run(() => navigate(`/documents/${TYPE_TO_SLUG[d.type]}/${d.id}`))}
                    >
                      <DocumentTypeIcon type={d.type} />
                      <span className="font-medium tabular-nums">{toDisplayDigits(d.number)}</span>
                      <span className="text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type].short}</span>
                      <span className="truncate">{d.buyerName || d.customer?.name || "—"}</span>
                      <CommandShortcut className="tracking-normal tabular-nums">
                        {formatJalaliDate(new Date(d.issueDate))}
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {productMatches.length > 0 && (
                <CommandGroup heading="کالاها">
                  {productMatches.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`product-${p.id}`}
                      onSelect={() =>
                        run(() => navigate(`/products?q=${encodeURIComponent(p.code ?? p.name)}`))
                      }
                    >
                      <CategoryIcon category={p.category} />
                      <span className="truncate">{p.name}</span>
                      <CommandShortcut className="tracking-normal">{p.code ?? CATEGORY_LABELS[p.category]}</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {commands.length > 0 && (
                <CommandGroup heading="رفتن و ساختن">
                  {commands.map((s) => (
                    <CommandItem key={s.id} value={s.id} onSelect={() => run(s.run)}>
                      {s.icon}
                      <span>{s.label}</span>
                      <CommandShortcut className="flex gap-1 tracking-normal">
                        <Kbd>{s.keys[0]}</Kbd>
                        <Kbd>{s.keys[1]}</Kbd>
                      </CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {themeMatches.length > 0 && (
                <CommandGroup heading="پوسته">
                  {themeMatches.map((t) => (
                    <CommandItem key={t.value} value={`theme-${t.value}`} onSelect={() => run(() => setTheme(t.value))}>
                      {t.icon}
                      <span>{t.label}</span>
                      {theme === t.value && <CommandShortcut className="tracking-normal">فعلی</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> جابه‌جایی
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Enter</Kbd> انتخاب
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd> بستن
              </span>
              <span className="ms-auto flex items-center gap-1">
                <Kbd>Ctrl K</Kbd> یا <Kbd>/</Kbd> باز کردن
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Search box in the header that opens the palette. */
export function CommandMenuTrigger() {
  const { open } = useCommandMenu();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={open}
      className="gap-2 text-muted-foreground sm:w-56 sm:justify-start"
      aria-label="جستجو و دستورات"
    >
      <Search />
      <span className="hidden sm:inline">جستجو...</span>
      <Kbd className="ms-auto hidden sm:inline-flex">Ctrl K</Kbd>
    </Button>
  );
}
