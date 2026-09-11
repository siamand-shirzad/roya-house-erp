import { useState } from "react";
import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toLatinDigits } from "@/lib/csv";
import { toDisplayDigits } from "@/lib/format";

export type BulkTarget = "unit" | "partner" | "both";
export type BulkAdjustment = { percent: number; target: BulkTarget; roundTo: number };

const TARGETS: { value: BulkTarget; label: string }[] = [
  { value: "unit", label: "قیمت واحد" },
  { value: "partner", label: "قیمت همکاری" },
  { value: "both", label: "هر دو" },
];

const ROUNDING: { value: number; label: string }[] = [
  { value: 1000, label: "1,000" },
  { value: 100, label: "100" },
  { value: 1, label: "بدون گرد کردن" },
];

// Percentage change for every row currently shown by the filters. It only
// creates unsaved edits; the user still reviews and presses Save.
export function BulkAdjustPopover({
  count,
  onApply,
}: {
  count: number;
  onApply: (adjustment: BulkAdjustment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [percentText, setPercentText] = useState("");
  const [target, setTarget] = useState<BulkTarget>("unit");
  const [roundTo, setRoundTo] = useState(1000);

  const percent = Number(toLatinDigits(percentText).replace("٫", ".").replace(/[%٪\s]/g, ""));
  const valid = percentText.trim() !== "" && Number.isFinite(percent) && percent !== 0 && percent > -100;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={count === 0}>
          <Percent /> تغییر گروهی
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">تغییر درصدی قیمت‌ها</p>
          <p className="text-xs text-muted-foreground">
            روی {toDisplayDigits(count)} کالای نمایش‌داده‌شده اعمال می‌شود. قبل از ذخیره می‌توانید بررسی یا لغو کنید.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-percent">درصد تغییر</Label>
          <Input
            id="bulk-percent"
            dir="ltr"
            inputMode="decimal"
            placeholder="مثلاً 8 یا -5"
            value={percentText}
            onChange={(e) => setPercentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) {
                onApply({ percent, target, roundTo });
                setOpen(false);
              }
            }}
          />
        </div>
        {[
          { label: "اعمال روی", options: TARGETS, value: target, set: (v: string) => setTarget(v as BulkTarget) },
          { label: "گرد کردن به نزدیک‌ترین (تومان)", options: ROUNDING, value: roundTo, set: (v: string) => setRoundTo(Number(v)) },
        ].map((group) => (
          <div key={group.label} className="space-y-2">
            <Label>{group.label}</Label>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => group.set(String(o.value))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    String(group.value) === String(o.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Button
          className="w-full"
          disabled={!valid}
          onClick={() => {
            onApply({ percent, target, roundTo });
            setOpen(false);
          }}
        >
          اعمال {valid ? `${percent > 0 ? "+" : ""}${toDisplayDigits(percent)}٪` : ""}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
