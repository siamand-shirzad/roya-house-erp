import { FileSpreadsheet, LoaderCircle, Plus, RefreshCw, TriangleAlert } from "lucide-react";

import { FormDialog } from "@/components/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toDisplayDigits } from "@/lib/format";
import type { CsvPreview } from "@/lib/priceListCsv";

// Preview of a price-list CSV before anything is written: what's new, what
// changes (old -> new per field), and which rows were rejected.
export function ImportCsvDialog({
  open,
  onOpenChange,
  fileName,
  preview,
  applying,
  error,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  preview: CsvPreview | null;
  applying: boolean;
  error: string | null;
  onApply: () => void;
}) {
  const n = (v: number) => toDisplayDigits(v);
  const canApply = !!preview && preview.rows.length > 0 && preview.missingColumns.length === 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={applying}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="size-5 text-primary" /> پیش‌نمایش ورود از CSV
        </span>
      }
      description={
        <span dir="auto" className="block truncate">
          {fileName}
        </span>
      }
      onSubmit={(e) => {
        e.preventDefault();
        if (canApply) onApply();
      }}
      footer={
        <>
          <Button type="submit" disabled={!canApply || applying}>
            {applying && <LoaderCircle className="animate-spin" />}
            اعمال {preview ? n(preview.rows.length) : ""} تغییر
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            انصراف
          </Button>
        </>
      }
    >
      {!preview ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" /> در حال خواندن فایل...
        </div>
      ) : preview.missingColumns.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>
            ستون‌های لازم در فایل پیدا نشد: {preview.missingColumns.join("، ")}. سطر اول فایل باید عنوان ستون‌ها
            باشد (مثل فایل «خروجی CSV»).
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              { label: "کالای جدید", value: preview.created.length, tone: "text-emerald-600 dark:text-emerald-400" },
              { label: "تغییر می‌کند", value: preview.changed.length, tone: "text-primary" },
              { label: "بدون تغییر", value: preview.unchanged, tone: "text-muted-foreground" },
              { label: "خطا", value: preview.errors.length, tone: "text-destructive" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border p-3">
                <div className={`text-2xl font-bold tabular-nums ${s.tone}`}>{n(s.value)}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {preview.errors.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
                <TriangleAlert className="size-4" /> سطرهای رد شده (وارد نمی‌شوند)
              </h3>
              <ul className="space-y-1 rounded-lg border border-destructive/30 p-2 text-sm">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium tabular-nums">سطر {n(e.row)}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview.created.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Plus className="size-4" /> کالاهای جدید
              </h3>
              <ul className="divide-y rounded-lg border text-sm">
                {preview.created.slice(0, 100).map((c) => (
                  <li key={c.code} className="flex justify-between gap-3 px-3 py-2">
                    <span>{c.name}</span>
                    <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                      {c.code}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview.changed.length > 0 && (
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <RefreshCw className="size-4" /> تغییرات
              </h3>
              <ul className="divide-y rounded-lg border text-sm">
                {preview.changed.slice(0, 200).map((c) => (
                  <li key={c.code} className="space-y-1 px-3 py-2">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{c.name}</span>
                      <span dir="ltr" className="font-mono text-xs text-muted-foreground">
                        {c.code}
                      </span>
                    </div>
                    {c.changes.map((ch) => (
                      <div key={ch.field} className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span>{ch.field}:</span>
                        <span className="tabular-nums line-through">{toDisplayDigits(ch.from)}</span>
                        <span aria-hidden>←</span>
                        <span className="font-semibold tabular-nums text-foreground">{toDisplayDigits(ch.to)}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              {preview.changed.length > 200 && (
                <p className="text-xs text-muted-foreground">و {n(preview.changed.length - 200)} مورد دیگر...</p>
              )}
            </section>
          )}

          {preview.rows.length === 0 && preview.errors.length === 0 && (
            <p className="text-sm text-muted-foreground">فایل با فهرست فعلی یکسان است؛ تغییری برای اعمال وجود ندارد.</p>
          )}
        </>
      )}
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </FormDialog>
  );
}
