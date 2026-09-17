import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarClock, HandCoins, Warehouse } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { formatToman, toDisplayDigits, toIsoDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { stockLevel } from "@/lib/stock";

// The header bell: things that need someone today — low stock, cheques due
// within a week (or overdue), and money customers still owe. Every page
// mounts its own header, so results are cached for a minute instead of being
// fetched on each navigation.

type Alert = { key: string; icon: ReactNode; text: string; to: string };

const TTL_MS = 60_000;
let cache: { userId: string; at: number; alerts: Alert[] } | null = null;

/** Drop the cached alerts after a write that changes them (receipt, payment...). */
export function invalidateHeaderAlerts() {
  cache = null;
}

async function loadAlerts(user: NonNullable<ReturnType<typeof useAuth>["user"]>): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const jobs: Promise<void>[] = [];
  if (can(user, "inventory")) {
    jobs.push(
      api.inventory.stock().then((rows) => {
        const low = rows.filter((r) => stockLevel(r) !== "ok").length;
        if (low) alerts.push({ key: "stock", icon: <Warehouse />, text: `${toDisplayDigits(low)} کالا زیر حداقل موجودی یا منفی است`, to: "/inventory?low=1" });
      })
    );
  }
  if (can(user, "payments")) {
    const weekAhead = new Date();
    weekAhead.setDate(weekAhead.getDate() + 7);
    const soon = toIsoDate(weekAhead);
    jobs.push(
      api.payments.list({ method: "CHEQUE", chequeStatus: "PENDING" }).then((rows) => {
        const due = rows.filter((p) => p.status === "ACTIVE" && p.chequeDueDate && p.chequeDueDate <= soon);
        if (due.length) {
          const today = toIsoDate(new Date());
          const overdue = due.filter((p) => p.chequeDueDate! < today).length;
          alerts.push({
            key: "cheques",
            icon: <CalendarClock />,
            text: `${toDisplayDigits(due.length)} چک تا یک هفته سررسید می‌شود${overdue ? ` (${toDisplayDigits(overdue)} سررسید گذشته)` : ""}`,
            to: "/payments?tab=cheques",
          });
        }
      }),
      api.payments.balances().then((rows) => {
        const debtors = rows.filter((r) => r.balance > 0);
        if (debtors.length) {
          const total = debtors.reduce((s, r) => s + r.balance, 0);
          alerts.push({
            key: "debt",
            icon: <HandCoins />,
            text: `${toDisplayDigits(debtors.length)} مشتری بدهکار — ${formatToman(total)} تومان`,
            to: "/payments?tab=balances",
          });
        }
      })
    );
  }
  await Promise.allSettled(jobs);
  return alerts.sort((a, b) => a.key.localeCompare(b.key));
}

export function HeaderNotifications() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[] | null>(
    cache && user && cache.userId === user.id ? cache.alerts : null
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (cache && cache.userId === user.id && Date.now() - cache.at < TTL_MS) return;
    let cancelled = false;
    loadAlerts(user).then((list) => {
      cache = { userId: user.id, at: Date.now(), alerts: list };
      if (!cancelled) setAlerts(list);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user || !(can(user, "inventory") || can(user, "payments"))) return null;
  const count = alerts?.length ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8" aria-label={count ? `${count} اعلان` : "اعلان‌ها"}>
          <Bell />
          {count > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums">
              {toDisplayDigits(count)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" data-mobile-sheet="" className="w-80 p-0">
        <div className="border-b px-4 py-2.5 text-sm font-semibold">نیازمند توجه</div>
        {alerts === null ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">در حال بررسی...</p>
        ) : alerts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">موردی برای پیگیری نیست.</p>
        ) : (
          <ul className="divide-y">
            {alerts.map((a) => (
              <li key={a.key}>
                <Link
                  to={a.to}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/60 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-primary"
                >
                  {a.icon}
                  <span>{a.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
