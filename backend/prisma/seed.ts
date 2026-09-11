import "dotenv/config";
import { pool, newId, SCHEMA_SQL } from "../src/lib/db";

// ---------------------------------------------------------------------------
// Product catalog, transcribed from "لیست قیمت محصولات رویاهاوس" (price list
// dated 1405/06/10, revision 01). All prices are in Toman, as printed on the
// sheet. Categories mirror the sections of the price list (01 through 07,
// plus the branded-panel comparison table).
// ---------------------------------------------------------------------------

type SeedProduct = {
  code: string;
  name: string;
  category: string;
  spec?: string;
  unit: string;
  unitPrice: number;
  partnerPrice?: number;
  packSize?: number;
};

const products: SeedProduct[] = [
  // 01 | پنل های گچی (Gypsum panels)
  { code: "GYP-001", name: "پنل گچی معمولی 12.5 میلی‌متر", category: "GYPSUM_PANEL", spec: "240×120×12.5 سانتی‌متر", unit: "مترمربع", unitPrice: 268000, partnerPrice: 298000 },
  { code: "GYP-002", name: "پنل گچی ضد رطوبت (MR) 12.5 میلی‌متر", category: "GYPSUM_PANEL", spec: "مقاوم در برابر رطوبت - 240×120×12.5 سانتی‌متر", unit: "مترمربع", unitPrice: 345000, partnerPrice: 385000 },
  { code: "GYP-003", name: "پنل گچی مقاوم در برابر آتش (FR)", category: "GYPSUM_PANEL", spec: "240×120×12.5 سانتی‌متر", unit: "مترمربع", unitPrice: 445000, partnerPrice: 495000 },
  { code: "GYP-004", name: "پنل گچی ضخیم 15 میلی‌متر", category: "GYPSUM_PANEL", spec: "240×120×15 سانتی‌متر", unit: "مترمربع", unitPrice: 555000, partnerPrice: 615000 },

  // 02 | سازه های فلزی (Metal structures) — base catalog
  { code: "PR-001", name: "سازه پروفیل F47", category: "METAL_STRUCTURE", spec: "شاخه 3 متری، ضخامت 0.6 میلی‌متر", unit: "شاخه", unitPrice: 37000, partnerPrice: 42000 },
  { code: "PR-002", name: "سازه پروفیل U36", category: "METAL_STRUCTURE", spec: "شاخه 3 متری، ضخامت 0.6 میلی‌متر", unit: "شاخه", unitPrice: 26500, partnerPrice: 29500 },
  { code: "PR-003", name: "نبشی سپری‌بندار L24", category: "METAL_STRUCTURE", spec: "شاخه 3 متری، ضخامت 0.5 میلی‌متر", unit: "شاخه", unitPrice: 20500, partnerPrice: 23500 },
  { code: "PR-004", name: "رانر محیطی U28", category: "METAL_STRUCTURE", spec: "شاخه 3 متری، ضخامت 0.5 میلی‌متر", unit: "شاخه", unitPrice: 16500, partnerPrice: 18900 },

  // 02 | سازه — detailed per-length variants (priced per متر طول)
  { code: "PR-F47-45", name: "پروفیل F47 (ضخامت 45)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 69500 },
  { code: "PR-F47-50", name: "پروفیل F47 (ضخامت 50)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 74000 },
  { code: "PR-F47-60", name: "پروفیل F47 (ضخامت 60)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 88000 },
  { code: "PR-U36-45", name: "پروفیل U36 (ضخامت 45)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 47000 },
  { code: "PR-U36-50", name: "پروفیل U36 (ضخامت 50)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 50000 },
  { code: "PR-U36-60", name: "پروفیل U36 (ضخامت 60)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 59000 },
  { code: "PR-L25-45", name: "نبشی L25 (ضخامت 45)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 33000 },
  { code: "PR-L25-50", name: "نبشی L25 (ضخامت 50)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 35000 },
  { code: "PR-L25-60", name: "نبشی L25 (ضخامت 60)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 41000 },
  { code: "PR-L25W-50", name: "نبشی L25 بال بلند (ضخامت 50)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 39000 },
  { code: "PR-L25W-60", name: "نبشی L25 بال بلند (ضخامت 60)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 46000 },
  { code: "PR-U36W-50", name: "پروفیل U36 بال بلند (ضخامت 50)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 53500 },
  { code: "PR-U36W-60", name: "پروفیل U36 بال بلند (ضخامت 60)", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 63500 },
  { code: "STD-050", name: "استاد C50", category: "METAL_STRUCTURE", spec: "طول شاخه 3 متر - 36 متر در بسته", unit: "متر طول", unitPrice: 102000 },
  { code: "STD-070", name: "استاد C70", category: "METAL_STRUCTURE", spec: "طول شاخه 3 متر - 36 متر در بسته", unit: "متر طول", unitPrice: 116000 },
  { code: "STD-100", name: "استاد C100", category: "METAL_STRUCTURE", spec: "طول شاخه 3 متر - 36 متر در بسته", unit: "متر طول", unitPrice: 190000 },
  { code: "RNR-050", name: "رانر C50", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 64 متر در بسته", unit: "متر طول", unitPrice: 84000 },
  { code: "RNR-070", name: "رانر C70", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 80 متر در بسته", unit: "متر طول", unitPrice: 102000 },
  { code: "RNR-100", name: "رانر C100", category: "METAL_STRUCTURE", spec: "طول شاخه 4 متر - 40 متر در بسته", unit: "متر طول", unitPrice: 159000 },

  // 03 | تایل های گچی (Gypsum ceiling tiles)
  { code: "TIL-001", name: "تایل سفید ساده", category: "GYPSUM_TILE", spec: "120×240 سانتی‌متر", unit: "مترمربع", unitPrice: 280000 },
  { code: "TIL-002", name: "تایل حصیری", category: "GYPSUM_TILE", spec: "120×240 سانتی‌متر", unit: "مترمربع", unitPrice: 280000 },
  { code: "TIL-003", name: "تایل تخم‌مرغی", category: "GYPSUM_TILE", spec: "120×240 سانتی‌متر", unit: "مترمربع", unitPrice: 280000 },
  { code: "TIL-004", name: "تایل پانچ نامنظم", category: "GYPSUM_TILE", spec: "120×240 سانتی‌متر", unit: "مترمربع", unitPrice: 280000 },
  { code: "TIL-L24", name: "نبشی 24L سفید", category: "GYPSUM_TILE", spec: "طول 3 متر", unit: "شاخه", unitPrice: 66000 },

  // 04 | سپری (Spline accessories)
  { code: "SPR-360", name: "سپری 3.60 فیکس", category: "SPRI_ACCESSORY", spec: "طول 3.60 متر", unit: "عدد", unitPrice: 93000 },
  { code: "SPR-120", name: "سپری 1.20 فیکس", category: "SPRI_ACCESSORY", spec: "طول 1.20 متر", unit: "عدد", unitPrice: 93000 },
  { code: "SPR-060", name: "سپری 0.60 فیکس", category: "SPRI_ACCESSORY", spec: "طول 0.6 متر", unit: "عدد", unitPrice: 93000 },

  // 05 | پیچ و بولت (Screws & bolts)
  { code: "AT-001", name: "پیچ TN 25", category: "SCREW_BOLT", unit: "عدد", unitPrice: 2100 },
  { code: "AT-002", name: "پیچ TN 35", category: "SCREW_BOLT", unit: "عدد", unitPrice: 2250 },
  { code: "AT-003", name: "آویز سقفی فنری", category: "SCREW_BOLT", unit: "عدد", unitPrice: 3800 },
  { code: "AT-004", name: "رابط یک‌طرفه", category: "SCREW_BOLT", unit: "عدد", unitPrice: 4500 },
  { code: "XMAT-PT", name: "پیچ پانل تایوانی XMAT", category: "SCREW_BOLT", spec: "بسته 1000 عددی", unit: "بسته", unitPrice: 1100000, packSize: 1000 },
  { code: "XMAT-ST", name: "پیچ سازه تایوانی XMAT", category: "SCREW_BOLT", spec: "بسته 1000 عددی", unit: "بسته", unitPrice: 1150000, packSize: 1000 },
  { code: "XMAT-PS", name: "پیچ پانل سرمته XMAT", category: "SCREW_BOLT", spec: "بسته 1000 عددی", unit: "بسته", unitPrice: 1200000, packSize: 1000 },
  { code: "XMAT-SS", name: "پیچ سازه سرمته XMAT", category: "SCREW_BOLT", spec: "بسته 1000 عددی", unit: "بسته", unitPrice: 1250000, packSize: 1000 },
  { code: "NAIL-CON", name: "میخ چاشنی بتن", category: "SCREW_BOLT", spec: "بسته 100 عددی", unit: "بسته", unitPrice: 880000, packSize: 100 },
  { code: "NAIL-IRON", name: "میخ چاشنی آهن", category: "SCREW_BOLT", spec: "بسته 100 عددی", unit: "بسته", unitPrice: 890000, packSize: 100 },

  // 06 | نوار و بتونه (Tape & putty)
  { code: "PT-001", name: "نوار درزگیر کاغذی 5 سانتی‌متر", category: "TAPE_PUTTY", unit: "رول", unitPrice: 58000 },
  { code: "PT-002", name: "بتونه درزگیر سفید", category: "TAPE_PUTTY", spec: "کیسه 25 کیلوگرمی", unit: "کیلو", unitPrice: 278000 },

  // 06 | اتصالات (Connectors)
  { code: "CON-CLIP", name: "کلیپس", category: "CONNECTOR", spec: "بسته 1000 عددی", unit: "بسته", unitPrice: 8800, packSize: 1000 },
  { code: "CON-BRK", name: "براکت", category: "CONNECTOR", spec: "بسته 500 عددی", unit: "بسته", unitPrice: 10300, packSize: 500 },
  { code: "CON-W", name: "اتصال W", category: "CONNECTOR", spec: "بسته 1000 عددی", unit: "بسته", unitPrice: 10800, packSize: 1000 },
  { code: "CON-HT90", name: "اتصال HT90", category: "CONNECTOR", spec: "بسته 1000 عددی", unit: "بسته", unitPrice: 5500, packSize: 1000 },

  // 07 | سایر محصولات (Other products)
  { code: "OTH-ROCKWOOL", name: "پشم سنگ", category: "OTHER", spec: "7.2 متر مربع", unit: "بسته", unitPrice: 780000 },
  { code: "OTH-KIPLUS", name: "نوار درزگیر کی‌پلاس", category: "OTHER", spec: "90 متری", unit: "رول", unitPrice: 430000 },
  { code: "OTH-PUTTYPWD", name: "پودر بتونه درزگیری", category: "OTHER", spec: "20 کیلویی", unit: "کیسه", unitPrice: 510000 },

  // پنل های برند مختلف (Branded panel comparison table)
  { code: "BRD-BANA-RG", name: "بانا RG", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 560000, packSize: 90 },
  { code: "BRD-BANA-MR", name: "بانا MR", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 690000, packSize: 90 },
  { code: "BRD-BANA-FR", name: "بانا FR", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 720000, packSize: 90 },
  { code: "BRD-MEGA-RG", name: "مگابرد صادراتی RG", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 558000, packSize: 92 },
  { code: "BRD-YAZD-RG", name: "یزد RG", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 590000, packSize: 106 },
  { code: "BRD-YAZD-MR", name: "یزد MR", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 740000, packSize: 106 },
  { code: "BRD-BATIS-RG", name: "باتیس RG", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 590000, packSize: 90 },
  { code: "BRD-GBOARD-RG", name: "جی برد RG", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 627000, packSize: 100 },
  { code: "BRD-GBOARD-MR", name: "جی برد MR", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 801000, packSize: 100 },
  { code: "BRD-GRANDEX", name: "گرندکس", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 4300000, packSize: 50 },
  { code: "BRD-BORDEX", name: "بردکس", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 4300000, packSize: 50 },
  { code: "BRD-KARVIUM", name: "کارویم", category: "BRAND_PANEL", spec: "2.40×1.20×12.5", unit: "برگ", unitPrice: 3700000, packSize: 50 },

  // Extra service line seen on real invoices (not a physical product)
  { code: "SRV-LOADING", name: "خدمات بارگیری", category: "OTHER", unit: "عدد", unitPrice: 160000 },
];

async function main() {
  console.log("Applying schema...");
  await pool.query(SCHEMA_SQL);

  console.log(`Seeding ${products.length} products...`);
  const productIdByCode: Record<string, string> = {};
  for (const p of products) {
    const existing = await pool.query("SELECT id FROM products WHERE code = $1", [p.code]);
    const id = existing.rows[0]?.id ?? newId("prod");
    productIdByCode[p.code] = id;
    await pool.query(
      `INSERT INTO products (id, code, name, category, spec, unit, unit_price, partner_price, pack_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET name=$3, category=$4, spec=$5, unit=$6, unit_price=$7, partner_price=$8, pack_size=$9`,
      [id, p.code, p.name, p.category, p.spec ?? null, p.unit, p.unitPrice, p.partnerPrice ?? null, p.packSize ?? null]
    );
  }

  console.log("Seeding company + customer...");
  const companyId = "royahouse-main";
  await pool.query(
    `INSERT INTO companies (id, name, legal_name, province, city, address, phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO NOTHING`,
    [
      companyId,
      "رویا هاوس",
      "رویا هاوس",
      "تهران",
      "تهران",
      "تهران، چهاردانگه به آزادگان شرق، خیابان غفاری، خیابان عرفان، عرفان یکم غربی، پلاک 105",
      "09357205000 / 09356115000",
    ]
  );

  const customerId = "customer-jalali";
  await pool.query(
    `INSERT INTO customers (id, name, customer_code) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
    [customerId, "خانم رویا جلالی", "1388"]
  );

  console.log("Seeding sample documents...");
  const sampleLines = [
    { code: "BRD-MEGA-RG", name: "پنل مگابرد صادراتی", unit: "برگ", quantity: 40, unitPrice: 558000 },
    { code: "STD-100", name: "استاد C100", unit: "متر طول", quantity: 6, unitPrice: 190000 },
    { code: "STD-050", name: "استاد C50", unit: "متر طول", quantity: 90, unitPrice: 102000 },
    { code: "XMAT-PT", name: "پیچ پانل تایوانی XMAT", unit: "بسته", quantity: 2, unitPrice: 1100000 },
    { code: "SRV-LOADING", name: "خدمات بارگیری", unit: "عدد", quantity: 1, unitPrice: 160000 },
  ];

  async function seedDocument(type: string, number: number, extra: Record<string, any> = {}) {
    const existing = await pool.query("SELECT id FROM documents WHERE type=$1 AND number=$2", [type, number]);
    if (existing.rows[0]) return existing.rows[0].id;

    const id = newId("doc");
    await pool.query(
      `INSERT INTO documents (id, type, number, status, issue_date, company_id, customer_id, buyer_name, related_invoice_no)
       VALUES ($1,$2,$3,'ISSUED',$4,$5,$6,$7,$8)`,
      [id, type, number, new Date("2026-08-02"), companyId, customerId, "خانم رویا جلالی", extra.relatedInvoiceNo ?? null]
    );
    for (let idx = 0; idx < sampleLines.length; idx++) {
      const line = sampleLines[idx];
      await pool.query(
        `INSERT INTO document_items (id, document_id, product_id, row_no, name, unit, quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [newId("item"), id, productIdByCode[line.code] ?? null, idx + 1, line.name, line.unit, line.quantity, line.unitPrice]
      );
    }
    return id;
  }

  await seedDocument("PROFORMA", 11842);
  await seedDocument("INVOICE", 2039);
  await seedDocument("GOODS_ISSUE", 2039, { relatedInvoiceNo: "2039" });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
