// Unit tests for pure logic (no database). Run with `npm test`, which builds first.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { computeLineTotals, computeDocumentTotals } = require("../dist/lib/totals");
const { accessFor, can } = require("../dist/lib/permissions");
const { toJalali, jalaliDay, jalaliDate } = require("../dist/lib/jalali");

test("line totals: round, subtract the discount, then add tax on the rest", () => {
  assert.deepEqual(computeLineTotals({ quantity: 2.5, unitPrice: 101, discount: 3, taxRate: 10 }), {
    lineTotal: 253,
    afterDiscount: 250,
    taxAmount: 25,
    grandTotal: 275,
  });
});

test("document totals add up every line", () => {
  const t = computeDocumentTotals([
    { quantity: 1, unitPrice: 1000 },
    { quantity: 3, unitPrice: 200, discount: 100, taxRate: 10 },
  ]);
  assert.deepEqual(t, { subtotal: 1600, discountTotal: 100, taxTotal: 50, grandTotal: 1550 });
});

test("default permissions by role", () => {
  assert.equal(accessFor({ role: "ADMIN" }, "payments"), "edit");
  assert.equal(accessFor({ role: "ACCOUNTANT" }, "payments"), "edit");
  assert.equal(accessFor({ role: "SALES" }, "payments"), "view");
  assert.equal(accessFor({ role: "WAREHOUSE" }, "payments"), "none");
  assert.equal(accessFor({ role: "WAREHOUSE" }, "goods_issue"), "edit");
  assert.equal(accessFor({ role: "SALES" }, "reports"), "none");
  assert.equal(can({ role: "SALES" }, "invoice", true), true);
  assert.equal(can(null, "dashboard"), false);
});

test("per-user permissions override the role default", () => {
  const user = { role: "SALES", permissions: { payments: "edit", invoice: "view" } };
  assert.equal(can(user, "payments", true), true);
  assert.equal(can(user, "invoice", true), false);
});

test("Jalali conversion", () => {
  assert.deepEqual(toJalali(new Date(2026, 8, 16)), { jy: 1405, jm: 6, jd: 25 });
  assert.deepEqual(toJalali(new Date(2025, 2, 21)), { jy: 1404, jm: 1, jd: 1 });
  assert.equal(jalaliDay("2026-09-16"), "1405/06/25");
  assert.equal(jalaliDay(null), "");
});

test("timestamps are read as Tehran calendar days", () => {
  // 21:00 UTC on the 15th is 00:30 on the 16th in Tehran.
  assert.equal(jalaliDate("2026-09-15T21:00:00Z"), "1405/06/25");
  assert.equal(jalaliDate("2026-09-15T20:00:00Z"), "1405/06/24");
});
