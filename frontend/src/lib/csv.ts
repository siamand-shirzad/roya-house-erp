// Small CSV reader/writer for the price list import/export.
// Written for Excel round-trips: UTF-8 with BOM on export, and on import it
// accepts a BOM, quoted fields, comma/semicolon/tab delimiters, CRLF, and
// files Excel saved in the legacy Windows Persian encoding (windows-1256).

/** Decode an uploaded file: UTF-8 first, falling back to windows-1256. */
export async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1256").decode(buf);
  }
}

function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Parse CSV text into rows of cells (RFC 4180 quoting). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(src.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully empty lines (common at the end of Excel exports).
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build CSV text with a BOM so Excel opens Persian text correctly. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(escapeCell).join(",")).join("\r\n");
}

/** Trigger a browser download of text content. */
export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** Persian/Arabic digits -> ASCII. */
export function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d] ?? d);
}

/**
 * Parse a user-typed or CSV number: accepts Persian digits and thousands
 * separators ("۱٬۲۵۰٬۰۰۰", "1,250,000", "1 250 000"). Returns null for
 * empty input and NaN for anything that isn't a whole non-negative number.
 */
export function parseAmount(raw: string): number | null {
  const s = toLatinDigits(raw).replace(/[\s,٬،']/g, "").trim();
  if (s === "") return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

/** Normalize a header/label for loose matching (case, spaces, ZWNJ). */
export function normalizeKey(s: string): string {
  return s.replace(/‌/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
