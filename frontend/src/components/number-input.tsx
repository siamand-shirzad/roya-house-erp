import { useEffect, useRef, useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { toLatinDigits } from "@/lib/csv";
import { cn } from "@/lib/utils";

// A number field that groups thousands with a comma while you type
// ("2500000" shows as "2,500,000"). Persian digits and the Persian decimal
// separator are accepted; the caller always gets a plain number back (or null
// when the field is empty), so the comma never reaches the API.

function groupThousands(int: string) {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Clean and group whatever was typed or pasted: "۲۵۰۰۰٫۵" -> "25,000.5". */
export function formatNumberText(raw: string, decimals: boolean): string {
  let s = toLatinDigits(raw).replace(/٫/g, ".");
  // A whole-number field drops a pasted fraction ("12.5" -> "12") rather than
  // gluing its digits on ("125").
  if (!decimals) s = s.split(".")[0];
  s = s.replace(decimals ? /[^\d.]/g : /\D/g, "");
  if (decimals) {
    const dot = s.indexOf(".");
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  const [intRaw, frac] = s.split(".");
  const int = intRaw.replace(/^0+(?=\d)/, "");
  return frac === undefined ? groupThousands(int) : `${groupThousands(int) || "0"}.${frac}`;
}

function toText(value: number | null, decimals: boolean) {
  if (value === null || !Number.isFinite(value)) return "";
  return formatNumberText(String(decimals ? value : Math.round(value)), decimals);
}

type NumberInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Allow a decimal part (quantities). Prices are whole Toman. */
  decimals?: boolean;
};

export function NumberInput({ value, onValueChange, decimals = false, className, onFocus, onBlur, ...props }: NumberInputProps) {
  const focused = useRef(false);
  const [text, setText] = useState(() => toText(value, decimals));

  // Follow changes made from outside (a product picked into the row), but
  // never rewrite the text under the user's cursor.
  useEffect(() => {
    if (!focused.current) setText(toText(value, decimals));
  }, [value, decimals]);

  return (
    <Input
      {...props}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      dir="ltr"
      className={cn("text-right tabular-nums", className)}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        setText(toText(value, decimals));
        onBlur?.(e);
      }}
      onChange={(e) => {
        const input = e.target;
        const caret = input.selectionStart ?? input.value.length;
        // How many digits (and the dot) sit left of the caret, so it can be put
        // back after the same digit once commas are re-inserted.
        const keep = toLatinDigits(input.value.slice(0, caret))
          .replace(/٫/g, ".")
          .replace(decimals ? /[^\d.]/g : /\D/g, "").length;
        const next = formatNumberText(input.value, decimals);
        setText(next);
        const plain = next.replace(/,/g, "");
        onValueChange(plain === "" ? null : Number(plain));
        requestAnimationFrame(() => {
          if (document.activeElement !== input) return;
          let pos = 0;
          let seen = 0;
          while (pos < next.length && seen < keep) {
            if (next[pos] !== ",") seen += 1;
            pos += 1;
          }
          input.setSelectionRange(pos, pos);
        });
      }}
    />
  );
}
