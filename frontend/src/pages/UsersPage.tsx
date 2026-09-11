import { useEffect, useState, type FormEvent } from "react";
import { Info, Loader2, Pencil, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatJalaliDate, toDisplayDigits } from "@/lib/format";
import { ROLE_LABELS, type User, type UserRole } from "@/types";

type FormState = { fullName: string; username: string; phone: string; role: UserRole; active: boolean; password: string };
const EMPTY_FORM: FormState = { fullName: "", username: "", phone: "", role: "SALES", active: true, password: "" };

const ROLE_TONE: Record<UserRole, string> = {
  ADMIN: "border-primary/30 bg-primary/10 text-primary",
  SALES: "border-border bg-muted text-foreground",
  WAREHOUSE: "border-border bg-muted text-foreground",
  ACCOUNTANT: "border-border bg-muted text-foreground",
};

// Server messages are English; show Persian for the ones users can act on.
function friendlyError(message: string) {
  if (message.includes("already exists")) return "این نام کاربری قبلاً ثبت شده است.";
  if (message.includes("active admin")) return "حداقل یک مدیر سیستم فعال باید باقی بماند.";
  if (message.includes("Validation")) return "اطلاعات فرم کامل یا معتبر نیست.";
  return message;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.users.list());
      setError(null);
    } catch (err) {
      setError(`دریافت کاربران ناموفق بود: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(user: User | null) {
    setEditing(user);
    setForm(
      user
        ? { fullName: user.fullName, username: user.username, phone: user.phone ?? "", role: user.role, active: user.active, password: "" }
        : EMPTY_FORM
    );
    setFormError(null);
    setSheetOpen(true);
  }

  const usernameValid = /^[a-z0-9._-]{3,32}$/.test(form.username.trim().toLowerCase());

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return setFormError("نام و نام خانوادگی الزامی است.");
    if (!usernameValid) return setFormError("نام کاربری باید 3 تا 32 حرف لاتین، عدد یا . _ - باشد.");
    if (!editing && !form.password) return setFormError("برای کاربر جدید رمز عبور تعیین کنید.");
    if (form.password && form.password.length < 8) return setFormError("رمز عبور باید حداقل 8 کاراکتر باشد.");
    setSaving(true);
    setFormError(null);
    try {
      const { password, ...rest } = form;
      const payload = { ...rest, phone: form.phone.trim() || null, ...(password ? { password } : {}) };
      if (editing) await api.users.update(editing.id, payload);
      else await api.users.create(payload);
      setSheetOpen(false);
      await load();
    } catch (err) {
      setFormError(friendlyError((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      const updated = await api.users.update(user.id, { active: !user.active });
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setError(`تغییر وضعیت ناموفق بود: ${friendlyError((err as Error).message)}`);
    }
  }

  return (
    <AppShell
      title="کاربران"
      actions={
        <Button size="sm" onClick={() => openForm(null)}>
          <UserPlus /> کاربر جدید
        </Button>
      }
    >
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            هر کاربر با نام کاربری و رمز عبور خودش وارد می‌شود. مدیر سیستم به همه‌ی بخش‌ها دسترسی دارد؛ بقیه‌ی
            نقش‌ها قیمت‌ها را فقط می‌بینند و به این صفحه دسترسی ندارند. غیرفعال کردن کاربر یا تغییر رمزش، او را
            از همه‌ی دستگاه‌ها خارج می‌کند.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2.5 text-right font-medium">نام</th>
                <th className="px-3 py-2.5 text-right font-medium">نام کاربری</th>
                <th className="px-3 py-2.5 text-right font-medium">تلفن</th>
                <th className="px-3 py-2.5 text-right font-medium">نقش</th>
                <th className="px-3 py-2.5 text-right font-medium">وضعیت</th>
                <th className="px-3 py-2.5 text-right font-medium">آخرین ورود</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-3 py-3.5">
                        <Skeleton className="h-4 w-full max-w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && users.length === 0 && !error && (
                <tr>
                  <td colSpan={7} className="py-14">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                        <Users className="size-5" />
                      </div>
                      هنوز کاربری ثبت نشده است.
                      <Button variant="outline" size="sm" onClick={() => openForm(null)}>
                        <UserPlus /> افزودن اولین کاربر
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                users.map((u) => (
                  <tr key={u.id} className={cn("hover:bg-muted/40", !u.active && "text-muted-foreground")}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {u.fullName}
                        {!u.hasPassword && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                            بدون رمز
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                      <span className="block text-right">{u.username}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{u.phone ? toDisplayDigits(u.phone) : "—"}</td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={ROLE_TONE[u.role]}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={u.active}
                        aria-label={`${u.active ? "غیرفعال" : "فعال"} کردن ${u.fullName}`}
                        onClick={() => toggleActive(u)}
                        className="inline-flex items-center gap-2"
                      >
                        <span
                          className={cn(
                            "relative h-5 w-9 rounded-full transition-colors",
                            u.active ? "bg-primary" : "bg-muted-foreground/30"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all",
                              // RTL switch: "on" sits at the left end.
                              u.active ? "right-[1.125rem]" : "right-0.5"
                            )}
                          />
                        </span>
                        <span className="text-xs">{u.active ? "فعال" : "غیرفعال"}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground">
                      {u.lastLoginAt ? formatJalaliDate(new Date(u.lastLoginAt)) : "هنوز وارد نشده"}
                    </td>
                    <td className="px-2 py-3">
                      <Button variant="ghost" size="icon" aria-label={`ویرایش ${u.fullName}`} onClick={() => openForm(u)}>
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={(o) => !saving && setSheetOpen(o)}>
        <SheetContent side="left" className="w-full gap-0 sm:max-w-md">
          <form onSubmit={submit} className="flex h-full flex-col">
            <SheetHeader className="border-b">
              <SheetTitle>{editing ? "ویرایش کاربر" : "کاربر جدید"}</SheetTitle>
              <SheetDescription>مشخصات کاربر سامانه فروش و انبار</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="space-y-2">
                <Label htmlFor="u-name">نام و نام خانوادگی</Label>
                <Input
                  id="u-name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-username">نام کاربری</Label>
                <Input
                  id="u-username"
                  dir="ltr"
                  className="text-left"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  aria-invalid={form.username !== "" && !usernameValid}
                />
                <p className="text-xs text-muted-foreground">حروف لاتین کوچک، عدد و . _ - (3 تا 32 کاراکتر)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-phone">تلفن همراه</Label>
                <Input
                  id="u-phone"
                  dir="ltr"
                  inputMode="tel"
                  className="text-left"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-password">{editing ? "رمز عبور جدید" : "رمز عبور"}</Label>
                <Input
                  id="u-password"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  className="text-left"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {editing
                    ? "برای تغییر ندادن رمز، خالی بگذارید. رمز جدید کاربر را از دستگاه‌های دیگر خارج می‌کند."
                    : "حداقل 8 کاراکتر. رمز را به‌صورت حضوری یا امن به کاربر بدهید."}
                </p>
              </div>
              <div className="space-y-2">
                <Label>نقش</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                کاربر فعال است
              </label>
              {formError && (
                <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              )}
            </div>
            <SheetFooter className="flex-row gap-2 border-t">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {editing ? "ذخیره تغییرات" : "افزودن کاربر"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
                انصراف
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
