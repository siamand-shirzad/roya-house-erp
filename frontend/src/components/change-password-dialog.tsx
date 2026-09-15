import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { FIELD, FormDialog, INPUT, LABEL } from "@/components/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";

// The signed-in user changes their own password (admins reset other people's
// on the users page). Other devices are signed out; this one stays signed in.
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCurrent("");
    setNext("");
    setRepeat("");
    setError(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("رمز جدید باید حداقل ۸ نویسه باشد.");
    if (next !== repeat) return setError("رمز جدید و تکرار آن یکسان نیستند.");
    setError(null);
    setSaving(true);
    try {
      await api.auth.changePassword(current, next);
      toast.success("رمز عبور تغییر کرد.", { description: "در دستگاه‌های دیگر باید دوباره وارد شوید." });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div className={FIELD}>
      <Label htmlFor={id} className={LABEL}>
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        dir="ltr"
        autoComplete={autoComplete}
        className={INPUT}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      title="تغییر رمز عبور"
      description="حداقل ۸ نویسه. پس از تغییر، نشست‌های دستگاه‌های دیگر بسته می‌شود."
      onSubmit={submit}
      footer={
        <>
          <Button type="submit" size="sm" disabled={saving || !current || !next}>
            {saving && <LoaderCircle className="animate-spin" />}
            تغییر رمز
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            انصراف
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {field("password-current", "رمز فعلی", current, setCurrent, "current-password")}
        {field("password-new", "رمز جدید", next, setNext, "new-password")}
        {field("password-repeat", "تکرار رمز جدید", repeat, setRepeat, "new-password")}
      </div>
      {error && (
        <Alert variant="destructive" className="py-2">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </FormDialog>
  );
}
