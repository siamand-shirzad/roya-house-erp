import { useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { formatToman } from "@/lib/format";
import { parseAmount } from "@/lib/csv";

// One editable price in the price-list grid. Spreadsheet keys:
//   Tab / Shift+Tab   next / previous cell (native focus order)
//   Enter / ArrowDown same column, next row      (commits)
//   Shift+Enter / ArrowUp  same column, previous row (commits)
//   Escape            revert this cell to its saved value
// Cells are addressed by data-grid-row / data-grid-col so the grid can move focus.

export function focusGridCell(row: number, col: number) {
  const el = document.querySelector<HTMLInputElement>(
    `input[data-grid-row="${row}"][data-grid-col="${col}"]`
  );
  el?.focus();
}

export function PriceCell({
  value,
  saved,
  row,
  col,
  nullable = false,
  onChange,
  label,
  readOnly = false,
}: {
  /** Show the price without an input (users who can't edit prices). */
  readOnly?: boolean;
  /** Current value, including unsaved edits. */
  value: number | null;
  /** Value stored in the database (to highlight edits and support Escape). */
  saved: number | null;
  row: number;
  col: number;
  nullable?: boolean;
  onChange: (value: number | null) => void;
  /** Accessible name, e.g. "قیمت واحد باتیس RG". */
  label: string;
}) {
  // null while not editing: the cell then shows the formatted value.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const dirty = (value ?? null) !== (saved ?? null);

  if (readOnly) {
    return (
      <span dir="ltr" className="block px-2 py-2 text-right text-sm tabular-nums">
        {value === null ? "—" : formatToman(value)}
      </span>
    );
  }

  function commit() {
    if (draft === null) return;
    const parsed = parseAmount(draft);
    if (Number.isNaN(parsed) || (parsed === null && !nullable)) {
      // Not a whole number: keep the previous value and flag briefly.
      setInvalid(true);
      setTimeout(() => setInvalid(false), 1200);
    } else if (parsed !== value) {
      onChange(parsed);
    }
    setDraft(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    const down = (e.key === "Enter" && !e.shiftKey) || e.key === "ArrowDown";
    const up = (e.key === "Enter" && e.shiftKey) || e.key === "ArrowUp";
    if (down || up) {
      e.preventDefault();
      commit();
      focusGridCell(row + (down ? 1 : -1), col);
    } else if (e.key === "Escape") {
      e.preventDefault();
      const input = e.currentTarget;
      if (dirty) onChange(saved);
      setDraft(saved === null ? "" : String(saved));
      requestAnimationFrame(() => input.select());
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      dir="ltr"
      aria-label={label}
      data-grid-row={row}
      data-grid-col={col}
      value={draft ?? (value === null ? "" : formatToman(value))}
      placeholder={nullable ? "—" : undefined}
      title={dirty ? `قیمت ذخیره‌شده: ${saved === null ? "خالی" : formatToman(saved)}` : undefined}
      onFocus={(e) => {
        setDraft(value === null ? "" : String(value));
        const input = e.currentTarget;
        requestAnimationFrame(() => input.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn(
        "h-9 w-full min-w-28 rounded-md border border-transparent bg-transparent px-2 text-right text-sm tabular-nums outline-none transition-colors",
        "hover:border-input focus:border-ring focus:bg-background focus:ring-[3px] focus:ring-ring/30",
        dirty && "border-primary/30 bg-primary/10 font-semibold text-primary",
        invalid && "border-destructive bg-destructive/10 ring-[3px] ring-destructive/20"
      )}
    />
  );
}
