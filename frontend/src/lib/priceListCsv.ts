import { normalizeKey, parseAmount, parseCsv, toCsv } from "@/lib/csv";
import { formatToman } from "@/lib/format";
import { CATEGORY_LABELS, type Product, type ProductCategory, type ProductImportRow } from "@/types";

// Column definitions for the price-list CSV. Exports use the Persian header;
// imports also accept the aliases (English keys, looser Persian spellings).
const COLUMNS = [
  { key: "code", header: "کد کالا", aliases: ["کد", "code"] },
  { key: "name", header: "نام کالا", aliases: ["نام", "name"] },
  { key: "category", header: "دسته‌بندی", aliases: ["دسته بندی", "دسته", "category"] },
  { key: "spec", header: "مشخصات", aliases: ["spec"] },
  { key: "unit", header: "واحد", aliases: ["unit"] },
  { key: "unitPrice", header: "قیمت واحد (تومان)", aliases: ["قیمت واحد", "قیمت", "unitprice", "unit_price", "price"] },
  { key: "partnerPrice", header: "قیمت همکاری (تومان)", aliases: ["قیمت همکاری", "partnerprice", "partner_price"] },
  { key: "packSize", header: "تعداد در بسته", aliases: ["packsize", "pack_size"] },
  { key: "active", header: "فعال", aliases: ["active"] },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const CATEGORY_BY_KEY = new Map<string, ProductCategory>(
  (Object.keys(CATEGORY_LABELS) as ProductCategory[]).flatMap((c) => [
    [normalizeKey(c), c],
    [normalizeKey(CATEGORY_LABELS[c]), c],
  ])
);

export function productsToCsv(products: Product[]): string {
  return toCsv(
    COLUMNS.map((c) => c.header),
    products.map((p) => [
      p.code ?? "",
      p.name,
      CATEGORY_LABELS[p.category] ?? p.category,
      p.spec ?? "",
      p.unit,
      p.unitPrice,
      p.partnerPrice ?? "",
      p.packSize ?? "",
      p.active ? "بله" : "خیر",
    ])
  );
}

export type FieldChange = { field: string; from: string; to: string };

export type CsvPreview = {
  /** Rows to send to the import endpoint (new + changed only). */
  rows: ProductImportRow[];
  created: { row: number; code: string; name: string }[];
  changed: { row: number; code: string; name: string; changes: FieldChange[] }[];
  unchanged: number;
  errors: { row: number; message: string }[];
  missingColumns: string[];
};

const FIELD_LABELS: Record<string, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.header]));

function parseActive(raw: string): boolean | undefined | "invalid" {
  const v = normalizeKey(raw);
  if (v === "") return undefined;
  if (["بله", "فعال", "true", "1", "yes"].includes(v)) return true;
  if (["خیر", "غیرفعال", "غیر فعال", "false", "0", "no"].includes(v)) return false;
  return "invalid";
}

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "خالی" : String(v));

/** Validate a CSV against the current catalog and describe what an import would do. */
export function previewProductCsv(text: string, current: Product[]): CsvPreview {
  const table = parseCsv(text);
  const preview: CsvPreview = { rows: [], created: [], changed: [], unchanged: 0, errors: [], missingColumns: [] };
  if (table.length === 0) {
    preview.errors.push({ row: 0, message: "فایل خالی است." });
    return preview;
  }

  // Map header cells to column keys.
  const header = table[0].map(normalizeKey);
  const index = {} as Record<ColumnKey, number>;
  for (const col of COLUMNS) {
    const names = [col.header, ...col.aliases].map(normalizeKey);
    index[col.key] = header.findIndex((h) => names.includes(h));
  }
  preview.missingColumns = (["code", "name", "category", "unit", "unitPrice"] as const)
    .filter((k) => index[k] === -1)
    .map((k) => FIELD_LABELS[k]);
  if (preview.missingColumns.length) return preview;

  const byCode = new Map(current.filter((p) => p.code).map((p) => [p.code!, p]));
  const seen = new Set<string>();

  table.slice(1).forEach((cells, i) => {
    const rowNo = i + 2; // 1-based, header is row 1
    const cell = (k: ColumnKey) => (index[k] === -1 ? "" : (cells[index[k]] ?? "").trim());
    const fail = (message: string) => preview.errors.push({ row: rowNo, message });

    const code = cell("code");
    if (!code) return fail("کد کالا خالی است.");
    if (seen.has(code)) return fail(`کد «${code}» در فایل تکراری است.`);
    seen.add(code);

    const name = cell("name");
    const unit = cell("unit");
    if (!name) return fail(`نام کالای «${code}» خالی است.`);
    if (!unit) return fail(`واحد کالای «${code}» خالی است.`);

    const category = CATEGORY_BY_KEY.get(normalizeKey(cell("category")));
    if (!category) return fail(`دسته‌بندی «${cell("category")}» برای «${code}» شناخته نشد.`);

    const unitPrice = parseAmount(cell("unitPrice"));
    if (unitPrice === null || Number.isNaN(unitPrice)) return fail(`قیمت واحد «${code}» عدد معتبر نیست.`);
    const partnerPrice = parseAmount(cell("partnerPrice"));
    if (Number.isNaN(partnerPrice)) return fail(`قیمت همکاری «${code}» عدد معتبر نیست.`);
    const packSize = parseAmount(cell("packSize"));
    if (Number.isNaN(packSize) || packSize === 0) return fail(`تعداد در بسته «${code}» عدد معتبر نیست.`);
    const active = parseActive(cell("active"));
    if (active === "invalid") return fail(`مقدار «فعال» برای «${code}» باید بله یا خیر باشد.`);

    const row: ProductImportRow = {
      code,
      name,
      category,
      spec: cell("spec") || null,
      unit,
      unitPrice,
      partnerPrice,
      packSize,
      ...(active !== undefined ? { active } : {}),
    };

    const existing = byCode.get(code);
    if (!existing) {
      preview.created.push({ row: rowNo, code, name });
      preview.rows.push(row);
      return;
    }

    const changes: FieldChange[] = [];
    const compare = (field: ColumnKey, from: unknown, to: unknown, fmt: (v: unknown) => string = show) => {
      if ((from ?? null) !== (to ?? null)) changes.push({ field: FIELD_LABELS[field], from: fmt(from), to: fmt(to) });
    };
    compare("name", existing.name, row.name);
    compare("category", existing.category, row.category, (v) => CATEGORY_LABELS[v as ProductCategory] ?? show(v));
    compare("spec", existing.spec || null, row.spec);
    compare("unit", existing.unit, row.unit);
    const price = (v: unknown) => (v === null || v === undefined ? "خالی" : formatToman(v as number));
    compare("unitPrice", existing.unitPrice, row.unitPrice, price);
    compare("partnerPrice", existing.partnerPrice, row.partnerPrice, price);
    compare("packSize", existing.packSize, row.packSize);
    if (active !== undefined) compare("active", existing.active, active, (v) => (v ? "بله" : "خیر"));

    if (changes.length) {
      preview.changed.push({ row: rowNo, code, name, changes });
      preview.rows.push(row);
    } else {
      preview.unchanged++;
    }
  });

  return preview;
}
