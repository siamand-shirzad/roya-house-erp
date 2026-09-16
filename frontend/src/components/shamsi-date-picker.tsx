import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "@daypicker/persian";
import "@daypicker/react/style.css";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const parse = (value: string) => value ? new Date(`${value}T12:00:00`) : undefined;
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Values stay Gregorian ISO dates for the API; the entire picker uses the Persian calendar. */
export function ShamsiDatePicker({ value, onChange, label, min, max }: { value: string; onChange: (value: string) => void; label: string; min?: string; max?: string }) {
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" aria-label={label} className="justify-between gap-3">
      <CalendarDays />{selected ? selected.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" }) : label}
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1rem)] p-3" dir="rtl">
      <DayPicker className="shamsi-calendar" mode="single" dir="rtl" selected={selected} defaultMonth={selected} captionLayout="dropdown" startMonth={new Date(2000, 0)} endMonth={new Date(new Date().getFullYear() + 10, 11)}
        disabled={[...(min ? [{ before: parse(min)! }] : []), ...(max ? [{ after: parse(max)! }] : [])]}
        onSelect={(date) => { onChange(date ? iso(date) : ""); setOpen(false); }} />
      <div className="mt-2 flex justify-between gap-2">
        <Button variant="ghost" onClick={() => { const today = iso(new Date()); if ((!min || today >= min) && (!max || today <= max)) { onChange(today); setOpen(false); } }}>امروز</Button>
        <Button variant="ghost" onClick={() => { onChange(""); setOpen(false); }}>پاک کردن تاریخ</Button>
      </div>
    </PopoverContent>
  </Popover>;
}
