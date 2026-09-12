import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, LogIn, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FullScreenStatus, useAuth } from "@/components/auth-provider";
import { errorMessage } from "@/lib/api";

// Sign-in screen. On a fresh install (no admin with a password yet) it turns
// into "create the first admin account".

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        dir="ltr"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pe-10 text-left"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "پنهان کردن رمز" : "نمایش رمز"}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const { status, login, setup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated") return <Navigate to={from} replace />;
  if (status === "loading") {
    return (
      <FullScreenStatus>
        <LoaderCircle className="size-5 animate-spin" />
      </FullScreenStatus>
    );
  }

  const isSetup = status === "setup";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSetup) {
      if (!fullName.trim()) return setError("نام و نام خانوادگی را وارد کنید.");
      if (!/^[a-z0-9._-]{3,32}$/.test(username.trim().toLowerCase()))
        return setError("نام کاربری باید 3 تا 32 حرف لاتین، عدد یا . _ - باشد.");
      if (password.length < 8) return setError("رمز عبور باید حداقل 8 کاراکتر باشد.");
      if (password !== confirm) return setError("رمز عبور و تکرار آن یکسان نیستند.");
    } else if (!username.trim() || !password) {
      return setError("نام کاربری و رمز عبور را وارد کنید.");
    }

    setBusy(true);
    try {
      if (isSetup) await setup({ fullName: fullName.trim(), username: username.trim(), password });
      else await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLogo className="h-20" />
          <p className="font-display text-sm tracking-wide text-muted-foreground">Sales &amp; Warehouse</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-lg font-bold">
              {isSetup ? <ShieldCheck className="size-5 text-primary" /> : <LogIn className="size-5 text-primary" />}
              {isSetup ? "ساخت حساب مدیر سیستم" : "ورود به سامانه"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isSetup
                ? "اولین بار است که سامانه راه‌اندازی می‌شود. حساب مدیر را بسازید؛ بعداً از بخش کاربران، حساب همکاران را اضافه کنید."
                : "با نام کاربری و رمز عبوری که مدیر سیستم برایتان ساخته وارد شوید."}
            </p>
          </div>

          {status === "offline" && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>ارتباط با سرور برقرار نشد.</AlertDescription>
            </Alert>
          )}

          {isSetup && (
            <div className="space-y-2">
              <Label htmlFor="fullName">نام و نام خانوادگی</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="username">نام کاربری</Label>
            <Input
              id="username"
              dir="ltr"
              className="text-left"
              autoComplete="username"
              autoFocus={!isSetup}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">رمز عبور</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete={isSetup ? "new-password" : "current-password"}
            />
            {isSetup && <p className="text-xs text-muted-foreground">حداقل 8 کاراکتر</p>}
          </div>
          {isSetup && (
            <div className="space-y-2">
              <Label htmlFor="confirm">تکرار رمز عبور</Label>
              <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" />}
            {isSetup ? "ساخت حساب و ورود" : "ورود"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <a href="/site" className="underline-offset-4 hover:text-foreground hover:underline">
            صفحه‌ی معرفی رویا هاوس
          </a>
        </p>
      </div>
    </div>
  );
}
