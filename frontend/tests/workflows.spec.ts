import { test, expect, type Page } from "@playwright/test";

const buyer = { id: "customer-test", name: "علی کریمی", phone: "09121234567", city: "تهران" };
const product = { id: "product-test", code: "123", name: "پنل گچی", category: "GYPSUM_PANEL", unit: "برگ", unitPrice: 250000, partnerPrice: 240000, active: true, updatedAt: "2026-09-16T00:00:00.000Z" };
const invoice = { id: "invoice-test", type: "INVOICE", number: 2040, status: "ISSUED", buyerName: buyer.name, customer: buyer, issueDate: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T00:00:00.000Z", items: [], totals: { subtotal: 250000, discountTotal: 0, taxTotal: 0, grandTotal: 250000 }, derived: [], company: null };

async function mockApi(page: Page, options: { failStock?: boolean; failSave?: boolean; role?: string; permissions?: Record<string,string> } = {}) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = [];
    let status = 200;
    if (path === "/auth/me") body = { id: "user-test", fullName: "کاربر آزمایش", role: options.role ?? "ADMIN", username: "test", permissions: options.permissions ?? {} };
    else if ((path === "/company" || path === "/documents/company")) body = { id: "company-test", name: "رویا هاوس" };
    else if (path === "/products") body = [product];
    else if (path === "/customers") body = [buyer];
    else if (path === `/customers/${buyer.id}`) body = buyer;
    else if (path === "/inventory/stock") {
      if (options.failStock) { status = 500; body = { error: "Unavailable" }; }
    } else if (path === "/documents" && route.request().method() === "POST") {
      if (options.failSave) { status = 500; body = { error: "Unavailable" }; }
      else body = { ...invoice, ...route.request().postDataJSON(), id: "saved-test", status: "DRAFT" };
    } else if (path === "/documents/page") body = { rows: [invoice], total: 1, page: 1, pageSize: 10 };
    else if (path === "/documents") body = [invoice];
    else if (path === "/documents/missing") { status = 404; body = { error: "Document not found" }; }
    else if (path.startsWith("/documents/")) body = invoice;
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("buyer-only edits block navigation and Stay preserves them", async ({ page }) => {
  await mockApi(page);
  await page.goto("/documents/invoice/new");
  await page.getByLabel("نام خریدار", { exact: true }).fill("خریدار آزمایش");
  await page.getByRole("link", { name: "مشتریان", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "ماندن در این صفحه" }).click();
  await expect(page.getByLabel("نام خریدار", { exact: true })).toHaveValue("خریدار آزمایش");
  await page.getByRole("link", { name: "مشتریان", exact: true }).click();
  await page.getByRole("button", { name: "خروج بدون ذخیره" }).click();
  await expect(page).toHaveURL(/\/customers$/);
});

test("save and leave a new document reaches the requested destination", async ({ page }) => {
  await mockApi(page);
  await page.goto("/documents/invoice/new");
  await page.getByRole("combobox", { name: /افزودن کالا/ }).click();
  await page.getByRole("option", { name: /پنل گچی/ }).click();
  await expect(page.getByLabel("تعداد، ردیف 1")).toBeFocused();
  await page.getByRole("link", { name: "مشتریان", exact: true }).click();
  await page.getByRole("button", { name: "ذخیره و خروج" }).click();
  await expect(page).toHaveURL(/\/customers$/);
});

test("failed save retains the entered items", async ({ page }) => {
  await mockApi(page, { failSave: true });
  await page.goto("/documents/invoice/new");
  await page.getByRole("combobox", { name: /افزودن کالا/ }).click();
  await page.getByRole("option", { name: /پنل گچی/ }).click();
  await page.getByRole("link", { name: "مشتریان", exact: true }).click();
  await page.getByRole("button", { name: "ذخیره و خروج" }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(page.getByLabel("تعداد، ردیف 1")).toHaveValue("1");
  await expect(page).toHaveURL(/\/documents\/invoice\/new$/);
});

test("stock failure shows unavailable state and retry", async ({ page }) => {
  await mockApi(page, { failStock: true });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("موجودی");
  await expect(page.getByRole("button", { name: "تلاش مجدد", exact: true })).toBeVisible();
});

test("normalized customer search and history links", async ({ page }) => {
  await mockApi(page);
  await page.goto("/customers?q=علي");
  await page.getByRole("link", { name: buyer.name, exact: true }).click();
  await expect(page).toHaveURL(/\/customers\/customer-test$/);
  await expect(page.getByRole("link", { name: "فاکتور 2040" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("link", { name: buyer.name, exact: true })).toBeVisible();
});

test("mobile item entry and undo do not overflow the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/documents/invoice/new");
  await page.getByRole("combobox", { name: /افزودن کالا/ }).click();
  await page.getByRole("option", { name: /پنل گچی/ }).click();
  await expect(page.getByLabel("تعداد، ردیف 1")).toBeVisible();
  await page.getByRole("button", { name: "حذف ردیف", exact: true }).click();
  await page.getByRole("button", { name: "بازگردانی", exact: true }).click();
  await expect(page.getByLabel("تعداد، ردیف 1")).toHaveValue("1");
  await page.screenshot({ path: "test-results/mobile-editor.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mobile-editor.png", fullPage: true });
});

test("failed document load cannot create an accidental replacement", async ({ page }) => {
  await mockApi(page);
  await page.goto("/documents/invoice/missing");
  await expect(page.getByRole("alert")).toContainText("بارگذاری سند ناموفق");
  await expect(page.getByRole("button", { name: "ثبت سند", exact: true })).toHaveCount(0);
});

test("warehouse sees dispatch tasks", async ({ page }) => {
  await mockApi(page, { role: "WAREHOUSE" });
  await page.goto("/");
  await expect(page.getByRole("link", { name: /آماده‌سازی حواله خروج/ })).toBeVisible();
  await page.screenshot({ path: "test-results/warehouse-dashboard.png", fullPage: true });
  await page.getByRole("link", { name: /آماده‌سازی حواله خروج/ }).click();
  await expect(page.getByRole("button", { name: "تبدیل به حواله", exact: true })).toBeVisible();
});

test("document filters reach the paged API and survive detail navigation", async ({ page }) => {
  await mockApi(page);
  const request = page.waitForRequest((r) => r.url().includes("/documents/page") && r.url().includes("status=ISSUED"));
  await page.goto("/documents/invoice?status=ISSUED&q=2040&from=2026-09-01");
  await request;
  await page.getByRole("link", { name: "2040", exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel("جستجوی اسناد")).toHaveValue("2040");
  await expect(page.getByRole("button", {name:"از تاریخ (شمسی)"})).toContainText("شهریور");
});

test("long PDFs keep whole rows and totals on the final page", async ({ page }) => {
  await mockApi(page);
  const items = Array.from({ length: 40 }, (_, i) => ({ id: `item-${i}`, name: `پنل گچی مقاوم در برابر رطوبت ${i + 1}`, unit: "برگ", quantity: 12, unitPrice: 250000, discount: 0, taxRate: 10 }));
  await page.route("**/api/documents/print-test", (route) => route.fulfill({ json: { ...invoice, items } }));
  await page.goto("/documents/invoice/print-test");
  await expect(page.locator("#document-print-area tbody tr")).toHaveCount(40);
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const modulePath = "/src/lib/print-pages.ts";
    const { createPrintPages } = await import(modulePath);
    const { host, pages } = createPrintPages(document.getElementById("document-print-area"));
    try {
      return pages.map((p: HTMLElement) => ({ height: p.getBoundingClientRect().height, rows: p.querySelectorAll("tbody tr").length, totals: p.querySelectorAll("tfoot").length }));
    } finally { host.remove(); }
  });
  expect(result.length).toBeGreaterThan(1);
  expect(result.reduce((sum: number, p: { rows: number }) => sum + p.rows, 0)).toBe(40);
  expect(result.every((p: { height: number }) => p.height <= 1123)).toBe(true);
  expect(result.slice(0, -1).every((p: { totals: number }) => p.totals === 0)).toBe(true);
  expect(result.at(-1).totals).toBe(1);
  const pdf = await page.evaluate(async () => {
    const modulePath = "/src/lib/exportPdf.ts";
    const { renderElementToPdf } = await import(modulePath);
    const output = await renderElementToPdf(document.getElementById("document-print-area"));
    return { pages: output.getNumberOfPages(), bytes: output.output("arraybuffer").byteLength };
  });
  expect(pdf.pages).toBe(result.length);
  expect(pdf.bytes).toBeGreaterThan(1000);
});


const catalog = [
  {...product,id:"bana",code:"BRD-BANA",name:"پنل بانا",brand:"BANA"},
  {...product,id:"gboard",code:"BRD-GBOARD",name:"پنل جیبرد",brand:"GBOARD"},
  {...product,id:"roya",code:"BRD-ROYA",name:"پنل رویا",brand:"ROYA"},
];
const stockRows = catalog.map((p) => ({productId:p.id,code:p.code,name:p.name,category:p.category,spec:null,unit:p.unit,onHand:12,minStock:2}));

test("product columns and brand filters persist independently of prices", async ({page}) => {
  await mockApi(page);
  await page.route("**/api/products", (route) => route.fulfill({json:catalog}));
  await page.goto("/products");
  await expect(page.getByRole("columnheader",{name:/کد کالا/})).toHaveCount(0);
  await page.getByRole("button",{name:"بانا",exact:true}).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("پنل بانا");
  await page.getByRole("button",{name:"نمایش ستون‌ها"}).click();
  await page.getByRole("menuitemcheckbox",{name:"کد کالا",exact:true}).click();
  await page.getByRole("menuitemcheckbox",{name:"قیمت همکاری",exact:true}).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("columnheader",{name:/کد کالا/})).toBeVisible();
  await expect(page.getByRole("columnheader",{name:/قیمت همکاری/})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("columnheader",{name:/کد کالا/})).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.screenshot({animations:"disabled",path:"test-results/products-desktop.png",fullPage:true});
});

test("inventory drag and keyboard reorder rows and persist across reloads", async ({page}) => {
  await mockApi(page);
  await page.route("**/api/inventory/stock",(route) => route.fulfill({json:stockRows}));
  await page.goto("/inventory");
  await expect(page.locator("tbody tr").first()).toContainText("پنل بانا");
  await expect(page.locator("tbody")).not.toContainText("BRD-BANA");
  const handle = page.getByRole("button",{name:"جابه‌جایی پنل بانا",exact:true});
  await handle.focus(); await page.keyboard.press("Space"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Space");
  await expect(page.locator("tbody tr").first()).toContainText("پنل جیبرد");
  await page.reload();
  await expect(page.locator("tbody tr").first()).toContainText("پنل جیبرد");
  const first = await page.getByRole("button",{name:"جابه‌جایی پنل جیبرد",exact:true}).boundingBox();
  const last = await page.getByRole("button",{name:"جابه‌جایی پنل رویا",exact:true}).boundingBox();
  await page.mouse.move(first!.x+20, first!.y+20); await page.mouse.down();
  await page.mouse.move(last!.x+20,last!.y+20,{steps:12}); await page.mouse.up();
  await expect(page.locator("tbody tr").last()).toContainText("پنل جیبرد");
});

test("English command palette separates navigation and creation", async ({page}) => {
  await mockApi(page); await page.goto("/products");
  await expect(page.getByRole("heading",{name:"فهرست کالاها و قیمت‌ها"})).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog=page.getByRole("dialog");
  await expect(dialog).toHaveAttribute("dir","ltr");
  await expect(dialog.getByText("Navigation",{exact:true})).toBeVisible();
  await expect(dialog.getByText("Create",{exact:true})).toBeVisible();
  await dialog.getByPlaceholder("Search pages, documents, products or actions…").fill("New Proforma");
  await dialog.getByRole("option",{name:/New Proforma/}).click();
  await expect(page).toHaveURL(/documents\/proforma\/new/);
  await page.keyboard.press("Control+k");
  await page.screenshot({animations:"disabled",path:"test-results/command.png"});
});

test("Shamsi calendar selects a date and preserves ISO values for the API", async ({page}) => {
  await mockApi(page); await page.goto("/documents/invoice?from=2026-09-01");
  await page.getByRole("button",{name:"از تاریخ (شمسی)"}).click();
  await expect(page.locator(".rdp-root")).toBeVisible();
  await expect(page.locator(".rdp-root")).toContainText("شهریور");
  await page.screenshot({animations:"disabled",path:"test-results/calendar.png"});
  await page.getByRole("button", { name: "شنبه ۱۴-ام شهریور ۱۴۰۵", exact: true }).click();
  await expect(page).toHaveURL(/from=2026-09-05/);
  await expect(page.getByRole("button",{name:"از تاریخ (شمسی)"})).toContainText("۱۴ شهریور ۱۴۰۵");
});

test("permissions hide sections and block direct navigation", async ({page}) => {
  await mockApi(page,{role:"SALES",permissions:{products:"none",invoice:"none",inventory:"none",reports:"view"}});
  await page.goto("/");
  await expect(page.getByRole("link",{name:"کالاها و قیمت‌ها",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"گزارشات",exact:true})).toBeVisible();
  await page.goto("/products");
  await expect(page.getByText("به این بخش دسترسی ندارید.",{exact:true})).toBeVisible();
});

test("admin can save individual permissions and view only a new reset password", async ({page}) => {
  await mockApi(page);
  const staff={id:"staff",fullName:"کاربر فروش",username:"sales_user",role:"SALES",active:true,hasPassword:true,permissions:{products:"view"}};
  await page.route("**/api/users",(route)=>route.fulfill({json:[staff]}));
  await page.route("**/api/users/staff",(route)=>route.fulfill({json:{...staff,...route.request().postDataJSON()}}));
  await page.goto("/users"); await page.getByRole("button",{name:"ویرایش کاربر فروش"}).click();
  await expect(page.locator("#u-password")).toHaveValue("");
  await page.getByRole("combobox",{name:"کالاها و قیمت‌ها",exact:true}).click();
  await page.getByRole("option",{name:"مشاهده و ویرایش",exact:true}).click();
  await page.getByRole("button",{name:"ساخت رمز جدید",exact:true}).click();
  await expect(page.locator("#u-password")).toHaveAttribute("type","text");
  expect((await page.locator("#u-password").inputValue()).length).toBe(16);
  await page.screenshot({animations:"disabled",path:"test-results/user-permissions.png",fullPage:true});
  const saved=page.waitForRequest((r)=>r.url().endsWith("/users/staff") && r.method()==="PUT");
  await page.getByRole("button",{name:"ذخیره تغییرات",exact:true}).click();
  expect((await saved).postDataJSON().permissions.products).toBe("edit");
});

test("issued proforma opens a linked editable revision", async ({page}) => {
  await mockApi(page);
  const original={...invoice,id:"quote",type:"PROFORMA",number:11843,items:[{...product,id:"line",quantity:1,discount:0,taxRate:0}]};
  const revision={...original,id:"revision",number:11844,status:"DRAFT",revisionOfId:"quote"};
  await page.route("**/api/documents/quote",(route)=>route.fulfill({json:original}));
  await page.route("**/api/documents/quote/revise",(route)=>route.fulfill({json:revision}));
  await page.route("**/api/documents/revision",(route)=>route.fulfill({json:revision}));
  await page.goto("/documents/proforma/quote");
  await page.getByRole("button",{name:"ویرایش پیش‌فاکتور (نسخه جدید)",exact:true}).click();
  await expect(page).toHaveURL(/documents\/proforma\/revision/);
  await expect(page.getByRole("link",{name:"مشاهده نسخه قبلی پیش‌فاکتور"})).toBeVisible();
  await expect(page.getByLabel("تعداد، ردیف 1")).toBeEnabled();
});

test("mobile products, inventory and calendar fit without tiny controls", async ({page}) => {
  await mockApi(page);
  await page.setViewportSize({width:360,height:800});
  await page.route("**/api/products",(route)=>route.fulfill({json:catalog}));
  await page.route("**/api/inventory/stock",(route)=>route.fulfill({json:stockRows}));
  for(const path of ["/products","/inventory"]) {
    await page.goto(path); await expect(page.locator("tbody tr")).toHaveCount(3);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const button = page.getByRole("button",{name:path==="/products" ? "نمایش ستون‌ها" : "جابه‌جایی پنل بانا",exact:true});
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({animations:"disabled",path:`test-results/mobile-${path.slice(1)}.png`,fullPage:true});
  }
  await page.goto("/documents/invoice");
  await page.getByRole("button",{name:"از تاریخ (شمسی)"}).click();
  const calendar=await page.locator(".rdp-root").boundingBox();
  expect(calendar!.width).toBeLessThanOrEqual(344);
  await page.screenshot({animations:"disabled",path:"test-results/mobile-calendar.png"});
});


test("collapsed sidebar keeps every icon inside the rail", async ({page}) => {
  await mockApi(page); await page.goto("/products");
  await page.locator('[data-slot="sidebar-trigger"]').click();
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state","collapsed");
  await expect.poll(async()=>Math.round((await page.locator('[data-slot="sidebar-container"]').boundingBox())!.width)).toBe(82);
  const positions=await page.locator('[data-slot="sidebar-container"]').evaluate((rail)=> {
    const bounds=rail.getBoundingClientRect();
    return Array.from(rail.querySelectorAll('[data-sidebar="menu-button"]')).map((button)=>{const b=button.getBoundingClientRect();return b.left>=bounds.left && b.right<=bounds.right && b.width>=40;});
  });
  expect(positions.length).toBeGreaterThan(5); expect(positions.every(Boolean)).toBe(true);
  const search=page.getByRole("button",{name:"جستجو و دستورات",exact:true});
  const icon=await search.locator("svg").boundingBox(); const button=await search.boundingBox();
  expect(icon!.x).toBeGreaterThanOrEqual(button!.x); expect(icon!.x+icon!.width).toBeLessThanOrEqual(button!.x+button!.width);
  await expect(search.locator("span")).toBeHidden();
  await page.screenshot({animations:"disabled",path:"test-results/sidebar-collapsed.png"});
});

test("mobile user access form fits and keeps saving accessible", async ({page}) => {
  await mockApi(page); await page.setViewportSize({width:360,height:800});
  await page.goto("/users"); await page.getByRole("button",{name:"کاربر جدید",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByText("دسترسی اختصاصی بخش‌ها",{exact:true}).scrollIntoViewIfNeeded();
  const bounds=await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(360); expect(bounds!.height).toBeLessThanOrEqual(800);
  await expect(dialog.getByRole("button",{name:"افزودن کاربر",exact:true})).toBeVisible();
  expect(await dialog.evaluate((el)=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({animations:"disabled",path:"test-results/mobile-user-access.png"});
});
