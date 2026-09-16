import { MODULES, MODULE_LABELS, accessFor, type Permissions, type Access } from "@/lib/permissions";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Info, LoaderCircle, Pencil, TriangleAlert, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD, FormDialog, INPUT, LABEL } from "@/components/form-dialog";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatJalaliDate, toDisplayDigits } from "@/lib/format";
import { ROLE_LABELS, type User, type UserRole } from "@/types";

type FormState = { permissions: Permissions; fullName: string; username: string; phone: string; role: UserRole; active: boolean; password: string };
const EMPTY_FORM: FormState = { permissions: {}, fullName: "", username: "", phone: "", role: "SALES", active: true, password: "" };

const ROLE_TONE: Record<UserRole, string> = {
  ADMIN: "border-primary/30 bg-primary/10 text-primary",
  SALES: "border-border bg-muted text-foreground",
  WAREHOUSE: "border-border bg-muted text-foreground",
  ACCOUNTANT: "border-border bg-muted text-foreground",
};

// Server messages are English; show Persian for the ones users can act on.
export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [resetMode, setResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setUsers(await api.users.list());
      setError(null);
    } catch (err) {
      setError(`دریافت کاربران ناموفق بود: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(user: User | null, reset = false) {
    setResetMode(reset);
    setEditing(user);
    setShowPassword(false);
    setForm(
      user
        ? { fullName: user.fullName, username: user.username, phone: user.phone ?? "", role: user.role, active: user.active, password: "", permissions: user.permissions ?? {} }
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
      setForm(EMPTY_FORM);
      setShowPassword(false);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      const updated = await api.users.update(user.id, { active: !user.active });
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
    } catch (err) {
      setError(`تغییر وضعیت ناموفق بود: ${errorMessage(err)}`);
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
            کاربران بر اساس دسترسی هر بخش کار می‌کنند. غیرفعال کردن کاربر یا تغییر رمزش، او را
            از همه‌ی دستگاه‌ها خارج می‌کند.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="mobile-data-table w-full md:min-w-[720px] text-sm">
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
                    <td data-label="نام" className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {u.fullName}
                        {!u.hasPassword && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                            بدون رمز
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td data-label="نام کاربری" className="px-3 py-3 font-mono text-xs" dir="ltr">
                      <span className="block text-right">{u.username}</span>
                    </td>
                    <td data-label="تلفن" className="px-3 py-3 tabular-nums">{u.phone ? toDisplayDigits(u.phone) : "—"}</td>
                    <td data-label="نقش" className="px-3 py-3">
                      <Badge variant="outline" className={ROLE_TONE[u.role]}>
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </td>
                    <td data-label="وضعیت" className="px-3 py-3">
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
                    <td data-label="آخرین ورود" className="px-3 py-3 text-xs tabular-nums text-muted-foreground">
                      {u.lastLoginAt ? formatJalaliDate(new Date(u.lastLoginAt)) : "هنوز وارد نشده"}
                    </td>
                    <td className="px-2 py-3">
                      <Button variant="ghost" size="icon" aria-label={`ویرایش ${u.fullName}`} onClick={() => openForm(u)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`بازنشانی رمز ${u.fullName}`} onClick={() => openForm(u, true)}><KeyRound /></Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <FormDialog
        open={sheetOpen}
        onOpenChange={(open) => { setSheetOpen(open); if (!open) { setForm(EMPTY_FORM); setShowPassword(false); } }}
        busy={saving}
        title={editing ? "ویرایش کاربر" : "کاربر جدید"}
        description="مشخصات کاربر سامانه فروش و انبار"
        onSubmit={submit}
        footer={
          <>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" />}
              {editing ? "ذخیره تغییرات" : "افزودن کاربر"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              انصراف
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-3">
          <div className={FIELD}>
            <Label htmlFor="u-name" className={LABEL}>
              نام و نام خانوادگی
            </Label>
            <Input
              id="u-name"
              className={INPUT}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              autoFocus={!resetMode}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="u-username" className={LABEL}>
              نام کاربری (لاتین کوچک، 3 تا 32)
            </Label>
            <Input
              id="u-username"
              dir="ltr"
              className={cn(INPUT, "text-left")}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              aria-invalid={form.username !== "" && !usernameValid}
            />
          </div>
          <div className={FIELD}>
            <Label htmlFor="u-phone" className={LABEL}>
              تلفن همراه
            </Label>
            <Input
              id="u-phone"
              dir="ltr"
              inputMode="tel"
              className={cn(INPUT, "text-left")}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className={cn(FIELD, "sm:col-span-2")}>
            <Label htmlFor="u-password" className={LABEL}>
              {editing ? "رمز عبور جدید (خالی = بدون تغییر)" : "رمز عبور (حداقل 8 کاراکتر)"}
            </Label>
            <Input
              id="u-password"
              autoFocus={resetMode}
              type={showPassword ? "text" : "password"}
              dir="ltr"
              autoComplete="new-password"
              className={cn(INPUT, "text-left")}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff /> : <Eye />}{showPassword ? "پنهان کردن رمز جدید" : "نمایش رمز جدید"}</Button>
              <Button type="button" variant="outline" onClick={() => { const bytes = crypto.getRandomValues(new Uint8Array(16)); setForm({ ...form, password: Array.from(bytes, (b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"[b % "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%".length]).join("") }); setShowPassword(true); }}><KeyRound /> ساخت رمز جدید</Button>
            </div>
            <p className="text-sm text-muted-foreground">رمز قبلی به‌صورت هش ذخیره شده و قابل نمایش نیست. با ذخیره رمز جدید، رمز کاربر بازنشانی می‌شود.</p>
          </div>
          <div className={FIELD}>
            <Label className={LABEL}>نقش</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
              <SelectTrigger size="sm" className="w-full">
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
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="user-active"
              checked={form.active}
              onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
            />
            <Label htmlFor="user-active" className="text-sm font-normal">
              کاربر فعال است
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {editing
              ? "رمز جدید، کاربر را از دستگاه‌های دیگر خارج می‌کند."
              : "رمز را حضوری یا از راه امن به کاربر بدهید."}
          </p>
        </div>

        <fieldset className="flex flex-col gap-3 rounded-xl border p-4">
          <legend className="px-2 font-medium">دسترسی اختصاصی بخش‌ها</legend>
          {form.role === "ADMIN" ? <p className="text-sm text-muted-foreground">مدیر سیستم به همه بخش‌ها دسترسی کامل دارد. برای محدود کردن دسترسی، نقش دیگری انتخاب کنید.</p> : <>
            <p className="text-sm text-muted-foreground">مخفی: بدون دسترسی؛ مشاهده: فقط خواندن؛ ویرایش: ثبت و تغییر اطلاعات. برای انتخاب کالا و مشتری در اسناد، دسترسی مشاهده این دو بخش را هم فعال کنید.</p>
            {MODULES.map((module) => <div key={module} className="grid grid-cols-[1fr_10rem] items-center gap-3">
              <Label htmlFor={`access-${module}`}>{MODULE_LABELS[module]}</Label>
              <Select value={form.permissions[module] ?? "default"} onValueChange={(value) => setForm((prev) => { const permissions = {...prev.permissions}; if (value === "default") delete permissions[module]; else permissions[module] = value as Access; return {...prev, permissions}; })}>
                <SelectTrigger id={`access-${module}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="default">طبق نقش ({({none:"مخفی",view:"مشاهده",edit:"ویرایش"})[accessFor({role:form.role},module)]})</SelectItem><SelectItem value="none">مخفی / بدون دسترسی</SelectItem><SelectItem value="view">مشاهده</SelectItem>{module !== "dashboard" && module !== "reports" && <SelectItem value="edit">مشاهده و ویرایش</SelectItem>}</SelectContent>
              </Select>
            </div>)}
            <Button variant="outline" type="button" onClick={() => setForm({...form,permissions:{}})}>بازگردانی به دسترسی‌های نقش</Button>
          </>}
        </fieldset>
        {formError && (
          <Alert variant="destructive" className="py-2">
            <TriangleAlert />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </FormDialog>
    </AppShell>
  );
}
