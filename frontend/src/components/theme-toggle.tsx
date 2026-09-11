import { useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/components/theme-provider";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "روشن", icon: Sun },
  { value: "dark", label: "تیره", icon: Moon },
  { value: "system", label: "مطابق سیستم", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="تغییر پوسته">
          {resolvedTheme === "dark" ? <Moon /> : <Sun />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTheme(value);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
              theme === value && "font-medium"
            )}
          >
            <Icon className="size-4 text-muted-foreground" />
            <span className="flex-1 text-right">{label}</span>
            {theme === value && <Check className="size-4 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
