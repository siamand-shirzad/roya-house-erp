import "dotenv/config";
import { pool, newId, SCHEMA_SQL } from "../src/lib/db";
import { computeDocumentTotals } from "../src/lib/totals";

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

  // Documents are stamped with the first active admin (if the app has been set
  // up already), so created_by / issued_by aren't empty on the sample data.
  const adminId: string | null =
    (await pool.query("SELECT id FROM users WHERE role = 'ADMIN' AND active = true ORDER BY created_at LIMIT 1"))
      .rows[0]?.id ?? null;

  type SeedCustomer = {
    customerCode?: string;
    nationalId?: string;
    economicCode?: string;
    province?: string;
    city?: string;
    address?: string;
    postalCode?: string;
    phone?: string;
  };

  async function seedCustomer(id: string, name: string, extra: SeedCustomer = {}) {
    await pool.query(
      `INSERT INTO customers (id, name, customer_code, national_id, economic_code, province, city, address, postal_code, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        name,
        extra.customerCode ?? null,
        extra.nationalId ?? null,
        extra.economicCode ?? null,
        extra.province ?? null,
        extra.city ?? null,
        extra.address ?? null,
        extra.postalCode ?? null,
        extra.phone ?? null,
      ]
    );
    return id;
  }

  type SeedLine = {
    code?: string;
    name: string;
    spec?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate?: number;
  };

  type SeedDoc = {
    type: "PROFORMA" | "INVOICE" | "GOODS_ISSUE";
    number: number;
    status?: "DRAFT" | "ISSUED" | "CANCELLED";
    issueDate?: string;
    customerId?: string | null;
    buyerName: string;
    buyerNationalId?: string;
    buyerEconomicCode?: string;
    buyerProvince?: string;
    buyerCity?: string;
    buyerAddress?: string;
    buyerPostalCode?: string;
    buyerPhone?: string;
    relatedInvoiceNo?: string;
    vehiclePlate?: string;
    vehicleColor?: string;
    deliveredToName?: string;
    deliveredToNationalId?: string;
    notes?: string;
    cancelReason?: string;
    sourceDocumentId?: string | null;
    lines: SeedLine[];
  };

  async function seedDocument(doc: SeedDoc): Promise<string> {
    const existing = await pool.query("SELECT id FROM documents WHERE type=$1 AND number=$2", [doc.type, doc.number]);
    if (existing.rows[0]) return existing.rows[0].id;

    const status = doc.status ?? "ISSUED";
    const issueDate = new Date(doc.issueDate ?? "2026-08-02");
    const cancelledAt = new Date(issueDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    const totals = computeDocumentTotals(doc.lines);
    const id = newId("doc");

    await pool.query(
      `INSERT INTO documents (
         id, type, number, status, issue_date, company_id, customer_id,
         buyer_name, buyer_national_id, buyer_economic_code, buyer_province, buyer_city,
         buyer_address, buyer_postal_code, buyer_phone,
         related_invoice_no, vehicle_plate, vehicle_color, delivered_to_name, delivered_to_national_id,
         notes, discount_total, tax_total,
         created_by, issued_at, issued_by, cancelled_at, cancelled_by, cancel_reason, source_document_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
      [
        id,
        doc.type,
        doc.number,
        status,
        issueDate,
        companyId,
        doc.customerId === undefined ? customerId : doc.customerId,
        doc.buyerName,
        doc.buyerNationalId ?? null,
        doc.buyerEconomicCode ?? null,
        doc.buyerProvince ?? null,
        doc.buyerCity ?? null,
        doc.buyerAddress ?? null,
        doc.buyerPostalCode ?? null,
        doc.buyerPhone ?? null,
        doc.relatedInvoiceNo ?? null,
        doc.vehiclePlate ?? null,
        doc.vehicleColor ?? null,
        doc.deliveredToName ?? null,
        doc.deliveredToNationalId ?? null,
        doc.notes ?? null,
        totals.discountTotal,
        totals.taxTotal,
        adminId,
        status === "DRAFT" ? null : issueDate,
        status === "DRAFT" ? null : adminId,
        status === "CANCELLED" ? cancelledAt : null,
        status === "CANCELLED" ? adminId : null,
        status === "CANCELLED" ? doc.cancelReason ?? "ابطال سند" : null,
        doc.sourceDocumentId ?? null,
      ]
    );

    for (let idx = 0; idx < doc.lines.length; idx++) {
      const line = doc.lines[idx];
      await pool.query(
        `INSERT INTO document_items (id, document_id, product_id, row_no, name, spec, unit, quantity, unit_price, discount, tax_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          newId("item"),
          id,
          line.code ? productIdByCode[line.code] ?? null : null,
          idx + 1,
          line.name,
          line.spec ?? null,
          line.unit,
          line.quantity,
          line.unitPrice,
          line.discount ?? 0,
          line.taxRate ?? 0,
        ]
      );
    }
    return id;
  }

  // The original three documents, transcribed from the paper forms.
  const sampleLines: SeedLine[] = [
    { code: "BRD-MEGA-RG", name: "پنل مگابرد صادراتی", unit: "برگ", quantity: 40, unitPrice: 558000 },
    { code: "STD-100", name: "استاد C100", unit: "متر طول", quantity: 6, unitPrice: 190000 },
    { code: "STD-050", name: "استاد C50", unit: "متر طول", quantity: 90, unitPrice: 102000 },
    { code: "XMAT-PT", name: "پیچ پانل تایوانی XMAT", unit: "بسته", quantity: 2, unitPrice: 1100000 },
    { code: "SRV-LOADING", name: "خدمات بارگیری", unit: "عدد", quantity: 1, unitPrice: 160000 },
  ];

  await seedDocument({ type: "PROFORMA", number: 11842, buyerName: "خانم رویا جلالی", lines: sampleLines });
  await seedDocument({ type: "INVOICE", number: 2039, buyerName: "خانم رویا جلالی", lines: sampleLines });
  await seedDocument({
    type: "GOODS_ISSUE",
    number: 2039,
    buyerName: "خانم رویا جلالی",
    relatedInvoiceNo: "2039",
    lines: sampleLines,
  });

  // ---------------------------------------------------------------------------
  // Extra test documents. Between them they cover every state the UI has to
  // render: drafts, issued and cancelled documents, a converted
  // PROFORMA -> INVOICE -> GOODS_ISSUE chain, lines with discount and tax,
  // decimal quantities, and a long document that spills onto a second PDF page.
  // ---------------------------------------------------------------------------
  console.log("Seeding extra test documents...");

  await seedCustomer("customer-arian", "شرکت ساختمانی آرین سازه", {
    customerCode: "1402",
    nationalId: "14008765432",
    economicCode: "411356789002",
    province: "تهران",
    city: "تهران",
    address: "تهران، شهرک غرب، بلوار دادمان، برج نگین، طبقه 7، واحد 14",
    postalCode: "1465774311",
    phone: "021-88567412",
  });
  await seedCustomer("customer-rostami", "آقای مهدی رستمی", {
    customerCode: "1455",
    nationalId: "0079123456",
    province: "البرز",
    city: "کرج",
    address: "کرج، گوهردشت، خیابان نهم شرقی، پلاک 22",
    phone: "09121234567",
  });
  await seedCustomer("customer-sepehr", "بازرگانی سپهر ساختمان", {
    customerCode: "1471",
    nationalId: "14003344556",
    economicCode: "411387654001",
    province: "تهران",
    city: "اسلامشهر",
    address: "اسلامشهر، شهرک صنعتی، خیابان صنعت 4، انبار مرکزی",
    postalCode: "3315896547",
    phone: "021-56238900",
  });
  await seedCustomer("customer-kazemi", "آقای سعید کاظمی", { customerCode: "1479", phone: "09193456781" });

  // 1) A draft proforma: editable and deletable, with no issue stamp.
  await seedDocument({
    type: "PROFORMA",
    number: 11843,
    status: "DRAFT",
    issueDate: "2026-09-05",
    customerId: "customer-arian",
    buyerName: "شرکت ساختمانی آرین سازه",
    buyerNationalId: "14008765432",
    buyerEconomicCode: "411356789002",
    buyerProvince: "تهران",
    buyerCity: "تهران",
    buyerAddress: "تهران، شهرک غرب، بلوار دادمان، برج نگین، طبقه 7، واحد 14",
    buyerPostalCode: "1465774311",
    buyerPhone: "021-88567412",
    notes: "اعتبار این پیش فاکتور 7 روز کاری است. بارگیری از انبار چهاردانگه.",
    lines: [
      { code: "GYP-001", name: "پنل گچی معمولی 12.5 میلی‌متر", spec: "240×120×12.5 سانتی‌متر", unit: "مترمربع", quantity: 320, unitPrice: 268000 },
      { code: "GYP-002", name: "پنل گچی ضد رطوبت (MR) 12.5 میلی‌متر", unit: "مترمربع", quantity: 86.4, unitPrice: 345000 },
      { code: "PR-001", name: "سازه پروفیل F47", spec: "شاخه 3 متری", unit: "شاخه", quantity: 240, unitPrice: 37000 },
      { code: "PR-002", name: "سازه پروفیل U36", spec: "شاخه 3 متری", unit: "شاخه", quantity: 120, unitPrice: 26500 },
      { code: "AT-003", name: "آویز سقفی فنری", unit: "عدد", quantity: 600, unitPrice: 3800 },
      { code: "XMAT-ST", name: "پیچ سازه تایوانی XMAT", spec: "بسته 1000 عددی", unit: "بسته", quantity: 4, unitPrice: 1150000 },
    ],
  });

  // 2) An issued proforma - the head of the conversion chain.
  const proformaRostami = await seedDocument({
    type: "PROFORMA",
    number: 11844,
    issueDate: "2026-08-18",
    customerId: "customer-rostami",
    buyerName: "آقای مهدی رستمی",
    buyerNationalId: "0079123456",
    buyerProvince: "البرز",
    buyerCity: "کرج",
    buyerAddress: "کرج، گوهردشت، خیابان نهم شرقی، پلاک 22",
    buyerPhone: "09121234567",
    lines: [
      { code: "BRD-YAZD-RG", name: "یزد RG", spec: "2.40×1.20×12.5", unit: "برگ", quantity: 106, unitPrice: 590000 },
      { code: "STD-070", name: "استاد C70", unit: "متر طول", quantity: 108, unitPrice: 116000 },
      { code: "RNR-070", name: "رانر C70", unit: "متر طول", quantity: 80, unitPrice: 102000 },
      { code: "PT-001", name: "نوار درزگیر کاغذی 5 سانتی‌متر", unit: "رول", quantity: 6, unitPrice: 58000 },
    ],
  });

  // 3) A cancelled proforma, with a reason.
  await seedDocument({
    type: "PROFORMA",
    number: 11845,
    status: "CANCELLED",
    issueDate: "2026-08-22",
    customerId: "customer-kazemi",
    buyerName: "آقای سعید کاظمی",
    buyerCity: "تهران",
    buyerPhone: "09193456781",
    cancelReason: "انصراف مشتری - سفارش با پیش فاکتور جدید ثبت شد.",
    lines: [
      { code: "TIL-001", name: "تایل سفید ساده", spec: "120×240 سانتی‌متر", unit: "مترمربع", quantity: 144, unitPrice: 280000 },
      { code: "SPR-360", name: "سپری 3.60 فیکس", unit: "عدد", quantity: 60, unitPrice: 93000 },
      { code: "SPR-120", name: "سپری 1.20 فیکس", unit: "عدد", quantity: 120, unitPrice: 93000 },
      { code: "TIL-L24", name: "نبشی 24L سفید", spec: "طول 3 متر", unit: "شاخه", quantity: 40, unitPrice: 66000 },
    ],
  });

  // 4) A long issued proforma - 14 rows, to check the second PDF page.
  await seedDocument({
    type: "PROFORMA",
    number: 11846,
    issueDate: "2026-09-01",
    customerId: "customer-sepehr",
    buyerName: "بازرگانی سپهر ساختمان",
    buyerNationalId: "14003344556",
    buyerEconomicCode: "411387654001",
    buyerProvince: "تهران",
    buyerCity: "اسلامشهر",
    buyerAddress: "اسلامشهر، شهرک صنعتی، خیابان صنعت 4، انبار مرکزی",
    buyerPostalCode: "3315896547",
    buyerPhone: "021-56238900",
    notes: "تسویه نقدی هنگام بارگیری. حمل بر عهده خریدار.",
    lines: [
      { code: "GYP-001", name: "پنل گچی معمولی 12.5 میلی‌متر", unit: "مترمربع", quantity: 720, unitPrice: 268000 },
      { code: "GYP-002", name: "پنل گچی ضد رطوبت (MR) 12.5 میلی‌متر", unit: "مترمربع", quantity: 172.8, unitPrice: 345000 },
      { code: "GYP-003", name: "پنل گچی مقاوم در برابر آتش (FR)", unit: "مترمربع", quantity: 57.6, unitPrice: 445000 },
      { code: "BRD-BANA-MR", name: "بانا MR", spec: "2.40×1.20×12.5", unit: "برگ", quantity: 90, unitPrice: 690000 },
      { code: "PR-001", name: "سازه پروفیل F47", unit: "شاخه", quantity: 500, unitPrice: 37000 },
      { code: "PR-002", name: "سازه پروفیل U36", unit: "شاخه", quantity: 250, unitPrice: 26500 },
      { code: "PR-004", name: "رانر محیطی U28", unit: "شاخه", quantity: 180, unitPrice: 16500 },
      { code: "STD-070", name: "استاد C70", unit: "متر طول", quantity: 216, unitPrice: 116000 },
      { code: "RNR-070", name: "رانر C70", unit: "متر طول", quantity: 160, unitPrice: 102000 },
      { code: "CON-CLIP", name: "کلیپس", spec: "بسته 1000 عددی", unit: "بسته", quantity: 3, unitPrice: 8800 },
      { code: "CON-BRK", name: "براکت", spec: "بسته 500 عددی", unit: "بسته", quantity: 3, unitPrice: 10300 },
      { code: "OTH-ROCKWOOL", name: "پشم سنگ", spec: "7.2 متر مربع", unit: "بسته", quantity: 24, unitPrice: 780000 },
      { code: "OTH-PUTTYPWD", name: "پودر بتونه درزگیری", spec: "20 کیلویی", unit: "کیسه", quantity: 12, unitPrice: 510000 },
      { code: "SRV-LOADING", name: "خدمات بارگیری", unit: "عدد", quantity: 1, unitPrice: 160000 },
    ],
  });

  // 5) The invoice converted from proforma 11844: discounts and 10% tax.
  const invoiceRostami = await seedDocument({
    type: "INVOICE",
    number: 2040,
    issueDate: "2026-08-20",
    customerId: "customer-rostami",
    buyerName: "آقای مهدی رستمی",
    buyerNationalId: "0079123456",
    buyerProvince: "البرز",
    buyerCity: "کرج",
    buyerAddress: "کرج، گوهردشت، خیابان نهم شرقی، پلاک 22",
    buyerPhone: "09121234567",
    sourceDocumentId: proformaRostami,
    lines: [
      { code: "BRD-YAZD-RG", name: "یزد RG", spec: "2.40×1.20×12.5", unit: "برگ", quantity: 106, unitPrice: 590000, discount: 2540000, taxRate: 10 },
      { code: "STD-070", name: "استاد C70", unit: "متر طول", quantity: 108, unitPrice: 116000, discount: 528000, taxRate: 10 },
      { code: "RNR-070", name: "رانر C70", unit: "متر طول", quantity: 80, unitPrice: 102000, taxRate: 10 },
      { code: "PT-001", name: "نوار درزگیر کاغذی 5 سانتی‌متر", unit: "رول", quantity: 6, unitPrice: 58000, taxRate: 10 },
    ],
  });

  // 6) A draft invoice with mixed tax rates and a decimal quantity.
  await seedDocument({
    type: "INVOICE",
    number: 2041,
    status: "DRAFT",
    issueDate: "2026-09-08",
    customerId: "customer-arian",
    buyerName: "شرکت ساختمانی آرین سازه",
    buyerNationalId: "14008765432",
    buyerEconomicCode: "411356789002",
    buyerProvince: "تهران",
    buyerCity: "تهران",
    buyerAddress: "تهران، شهرک غرب، بلوار دادمان، برج نگین، طبقه 7، واحد 14",
    buyerPostalCode: "1465774311",
    buyerPhone: "021-88567412",
    notes: "مبلغ فاکتور پس از کسر تخفیف و با احتساب مالیات بر ارزش افزوده است.",
    lines: [
      { code: "GYP-001", name: "پنل گچی معمولی 12.5 میلی‌متر", unit: "مترمربع", quantity: 288, unitPrice: 268000, discount: 1500000, taxRate: 10 },
      { code: "PR-001", name: "سازه پروفیل F47", unit: "شاخه", quantity: 210, unitPrice: 37000, taxRate: 10 },
      { code: "AT-001", name: "پیچ TN 25", unit: "عدد", quantity: 2500, unitPrice: 2100, taxRate: 10 },
      { code: "PT-002", name: "بتونه درزگیر سفید", spec: "کیسه 25 کیلوگرمی", unit: "کیلو", quantity: 62.5, unitPrice: 278000, taxRate: 10 },
      { code: "SRV-LOADING", name: "خدمات بارگیری", unit: "عدد", quantity: 2, unitPrice: 160000 },
    ],
  });

  // 7) The goods issue converted from invoice 2040 - still a draft.
  await seedDocument({
    type: "GOODS_ISSUE",
    number: 2041,
    status: "DRAFT",
    issueDate: "2026-08-21",
    customerId: "customer-rostami",
    buyerName: "آقای مهدی رستمی",
    buyerCity: "کرج",
    buyerAddress: "کرج، گوهردشت، خیابان نهم شرقی، پلاک 22",
    buyerPhone: "09121234567",
    relatedInvoiceNo: "2040",
    sourceDocumentId: invoiceRostami,
    vehiclePlate: "22 ع 471 ایران 68",
    vehicleColor: "سفید",
    deliveredToName: "آقای حسین نوری",
    deliveredToNationalId: "0082345671",
    lines: [
      { code: "BRD-YAZD-RG", name: "یزد RG", spec: "2.40×1.20×12.5", unit: "برگ", quantity: 106, unitPrice: 590000 },
      { code: "STD-070", name: "استاد C70", unit: "متر طول", quantity: 108, unitPrice: 116000 },
      { code: "RNR-070", name: "رانر C70", unit: "متر طول", quantity: 80, unitPrice: 102000 },
      { code: "PT-001", name: "نوار درزگیر کاغذی 5 سانتی‌متر", unit: "رول", quantity: 6, unitPrice: 58000 },
    ],
  });

  // 8) A standalone issued goods issue with full vehicle and delivery data.
  await seedDocument({
    type: "GOODS_ISSUE",
    number: 2042,
    issueDate: "2026-09-02",
    customerId: "customer-sepehr",
    buyerName: "بازرگانی سپهر ساختمان",
    buyerProvince: "تهران",
    buyerCity: "اسلامشهر",
    buyerAddress: "اسلامشهر، شهرک صنعتی، خیابان صنعت 4، انبار مرکزی",
    buyerPhone: "021-56238900",
    relatedInvoiceNo: "2038",
    vehiclePlate: "45 ب 812 ایران 22",
    vehicleColor: "آبی",
    deliveredToName: "آقای رضا شفیعی",
    deliveredToNationalId: "0061234598",
    notes: "بار در دو نوبت تحویل شد؛ نوبت دوم صبح روز بعد.",
    lines: [
      { code: "GYP-001", name: "پنل گچی معمولی 12.5 میلی‌متر", unit: "مترمربع", quantity: 720, unitPrice: 268000 },
      { code: "BRD-BANA-MR", name: "بانا MR", spec: "2.40×1.20×12.5", unit: "برگ", quantity: 90, unitPrice: 690000 },
      { code: "PR-001", name: "سازه پروفیل F47", unit: "شاخه", quantity: 500, unitPrice: 37000 },
      { code: "OTH-ROCKWOOL", name: "پشم سنگ", spec: "7.2 متر مربع", unit: "بسته", quantity: 24, unitPrice: 780000 },
      { code: "NAIL-CON", name: "میخ چاشنی بتن", spec: "بسته 100 عددی", unit: "بسته", quantity: 2, unitPrice: 880000 },
    ],
  });

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
