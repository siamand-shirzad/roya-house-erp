import { FileSpreadsheet, LoaderCircle, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toDisplayDigits } from "@/lib/format";
import type { CsvPreview } from "@/lib/priceListCsv";

// Preview of a price-list CSV before anything is written: what's new, what
// changes (old -> new per field), and which rows were rejected.
export function ImportCsvSheet({
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" /> پیش‌نمایش ورود از CSV
          </SheetTitle>
          <SheetDescription dir="auto" className="truncate">
            {fileName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {!preview ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> در حال خواندن فایل...
            </div>
          ) : preview.missingColumns.length > 0 ? (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                ستون‌های لازم در فایل پیدا نشد: {preview.missingColumns.join("، ")}. سطر اول فایل باید عنوان
                ستون‌ها باشد (مثل فایل «خروجی CSV»).
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
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 p-2 text-sm">
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
                    <p className="text-xs text-muted-foreground">
                      و {n(preview.changed.length - 200)} مورد دیگر...
                    </p>
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
        </div>

        <SheetFooter className="flex-row gap-2 border-t">
          <Button onClick={onApply} disabled={!canApply || applying}>
            {applying && <LoaderCircle className="animate-spin" />}
            اعمال {preview ? n(preview.rows.length) : ""} تغییر
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            انصراف
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
