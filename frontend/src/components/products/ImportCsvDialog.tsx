import { FileSpreadsheet, LoaderCircle, Plus, RefreshCw, TriangleAlert } from "lucide-react";

import { FormDialog } from "@/components/form-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toDisplayDigits } from "@/lib/format";
import type { CsvPreview } from "@/lib/priceListCsv";

// Preview of a price-list CSV before anything is written. It never scrolls:
// the counts carry the full picture, and each list shows its first few rows
// (with "و N مورد دیگر" beside its heading), which is enough to spot a wrong
// file or a bad column. Sized so the fullest case fits a 529px-tall window.
const SHOWN = 5;
const SHOWN_ERRORS = 2;

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
  const more = (total: number, shown: number) =>
    total > shown ? (
      <span className="ms-auto font-normal text-muted-foreground">و {n(total - shown)} مورد دیگر</span>
    ) : null;

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
          <Button type="submit" size="sm" disabled={!canApply || applying}>
            {applying && <LoaderCircle className="animate-spin" />}
            اعمال {preview ? n(preview.rows.length) : ""} تغییر
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
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
        <Alert variant="destructive" className="py-2">
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
              <div key={s.label} className="rounded-lg border px-3 py-1">
                <div className={`text-lg font-bold tabular-nums ${s.tone}`}>{n(s.value)}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {preview.errors.length > 0 && (
            <section className="space-y-1">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <TriangleAlert className="size-3.5" /> سطرهای رد شده (وارد نمی‌شوند)
                {more(preview.errors.length, SHOWN_ERRORS)}
              </h3>
              <ul className="rounded-lg border border-destructive/30 text-xs">
                {preview.errors.slice(0, SHOWN_ERRORS).map((e, i) => (
                  <li key={i} className="truncate px-3 py-1">
                    <span className="font-medium tabular-nums">سطر {n(e.row)}:</span> {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(preview.created.length > 0 || preview.changed.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <section className="space-y-1">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                  <Plus className="size-3.5" /> کالاهای جدید
                  {more(preview.created.length, SHOWN)}
                </h3>
                {preview.created.length === 0 ? (
                  <p className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground">کالای جدیدی نیست.</p>
                ) : (
                  <ul className="divide-y rounded-lg border text-xs">
                    {preview.created.slice(0, SHOWN).map((c) => (
                      <li key={c.code} className="flex justify-between gap-3 px-3 py-1.5">
                        <span className="truncate">{c.name}</span>
                        <span dir="ltr" className="shrink-0 font-mono text-muted-foreground">
                          {c.code}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-1">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                  <RefreshCw className="size-3.5" /> تغییرات
                  {more(preview.changed.length, SHOWN)}
                </h3>
                {preview.changed.length === 0 ? (
                  <p className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground">تغییری نیست.</p>
                ) : (
                  <ul className="divide-y rounded-lg border text-xs">
                    {preview.changed.slice(0, SHOWN).map((c) => {
                      const [first, ...rest] = c.changes;
                      return (
                        <li key={c.code} className="flex items-center justify-between gap-3 px-3 py-1.5">
                          <span className="truncate font-medium">{c.name}</span>
                          {first && (
                            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                              <span className="tabular-nums line-through">{toDisplayDigits(first.from)}</span>
                              <span aria-hidden>←</span>
                              <span className="font-semibold tabular-nums text-foreground">{toDisplayDigits(first.to)}</span>
                              {rest.length > 0 && <span>+{n(rest.length)}</span>}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {preview.rows.length === 0 && preview.errors.length === 0 && (
            <p className="text-sm text-muted-foreground">فایل با فهرست فعلی یکسان است؛ تغییری برای اعمال وجود ندارد.</p>
          )}
        </>
      )}
      {error && (
        <Alert variant="destructive" className="py-2">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </FormDialog>
  );
}
