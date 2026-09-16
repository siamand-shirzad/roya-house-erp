// Integration tests only against the disposable database documented in README.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const express = require('express');
const url = new URL(process.env.TEST_DATABASE_URL || 'postgres://postgres:roya-test-only@127.0.0.1:55432/roya_uiux_test');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/roya_uiux_test') {
  throw new Error('Tests require the isolated local roya_uiux_test database. Production is never used.');
}
const bootstrap = new Pool({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
const schema = `roya_test_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('options', `-csearch_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const { pool, SCHEMA_SQL } = require('../dist/lib/db');
const { documentsRouter } = require('../dist/routes/documents');
const { productsRouter } = require('../dist/routes/products');
const { usersRouter } = require('../dist/routes/users');
const { inventoryRouter } = require('../dist/routes/inventory');
const { companyRouter } = require('../dist/routes/company');
const { requireRole, verifyPassword } = require('../dist/lib/auth');
let server, base;
before(async () => {
  await bootstrap.query(`CREATE SCHEMA "${schema}"`);
  await pool.query(SCHEMA_SQL);
  await pool.query("INSERT INTO users(id,full_name,username,role) VALUES('admin','Test','test','ADMIN')");
  await pool.query("INSERT INTO companies(id,name) VALUES('company','Test')");
  await pool.query("INSERT INTO products(id,name,category,unit,unit_price) VALUES('product','Panel','GYPSUM_PANEL','sheet',100)");
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { res.locals.user = { id: 'admin', role: req.get('x-test-role') || 'ADMIN', permissions: JSON.parse(req.get('x-test-permissions') || '{}') }; next(); });
  app.use('/documents', documentsRouter);
  app.use('/products', productsRouter);
  app.use('/users', requireRole('ADMIN'), usersRouter);
  app.use('/inventory', inventoryRouter);
  app.use('/company', companyRouter);
  app.use((err, req, res, next) => res.status(err.name === 'ZodError' ? 400 : 500).json({ error: err.message }));
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await bootstrap.end();
});
async function request(path, method = 'GET', body, role = 'ADMIN', permissions = {}) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-test-role': role, 'x-test-permissions': JSON.stringify(permissions) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
const items = (quantity = 1) => [{ productId: 'product', name: 'Panel', unit: 'sheet', quantity, unitPrice: 100 }];
async function draft(type = 'PROFORMA') {
  const result = await request('/documents', 'POST', { type, items: items() });
  assert.equal(result.status, 201);
  return result.body;
}

test('simultaneous conversions create exactly one active child', async () => {
  const doc = await draft();
  assert.equal((await request(`/documents/${doc.id}/issue`, 'POST')).status, 200);
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => request(`/documents/${doc.id}/convert`, 'POST', { to: 'INVOICE' })));
  assert.equal(outcomes.filter((r) => r.status === 201).length, 1);
  assert.equal(outcomes.filter((r) => r.status === 409).length, 7);
  const rows = await pool.query('SELECT id FROM documents WHERE source_document_id=$1', [doc.id]);
  assert.equal(rows.rowCount, 1);
});

test('cancellation and conversion cannot leave a live child of a cancelled source', async () => {
  for (let i = 0; i < 5; i++) {
    const doc = await draft();
    await request(`/documents/${doc.id}/issue`, 'POST');
    const results = await Promise.all([
      request(`/documents/${doc.id}/cancel`, 'POST', {}),
      request(`/documents/${doc.id}/convert`, 'POST', { to: 'INVOICE' }),
    ]);
    assert.equal(results.filter((r) => r.status === 409).length, 1);
    const invalid = await pool.query("SELECT child.id FROM documents child JOIN documents parent ON parent.id=child.source_document_id WHERE parent.id=$1 AND parent.status='CANCELLED' AND child.status<>'CANCELLED'", [doc.id]);
    assert.equal(invalid.rowCount, 0);
  }
});

test('stale document edits are rejected without replacing the winner', async () => {
  const doc = await draft();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal((await request(`/documents/${doc.id}`, 'PUT', { items: items(2), expectedUpdatedAt: doc.updatedAt })).status, 200);
  assert.equal((await request(`/documents/${doc.id}`, 'PUT', { items: items(9), expectedUpdatedAt: doc.updatedAt })).status, 409);
  assert.equal((await request(`/documents/${doc.id}`)).body.items[0].quantity, 2);
});

test('concurrent edit and issue preserve agreement between goods issue and stock', async () => {
  for (let i = 0; i < 5; i++) {
    const doc = await draft('GOODS_ISSUE');
    const results = await Promise.all([
      request(`/documents/${doc.id}`, 'PUT', { items: items(7), expectedUpdatedAt: doc.updatedAt }),
      request(`/documents/${doc.id}/issue`, 'POST'),
    ]);
    assert.equal(results[1].status, 200);
    assert.ok([200, 409].includes(results[0].status));
    const saved = (await request(`/documents/${doc.id}`)).body;
    const movement = await pool.query("SELECT sum(quantity)::numeric AS quantity FROM stock_movements WHERE document_id=$1 AND kind='ISSUE'", [doc.id]);
    assert.equal(Number(movement.rows[0].quantity), -saved.items[0].quantity);
  }
});

test('repeated issue and cancellation book stock only once each', async () => {
  const doc = await draft('GOODS_ISSUE');
  const issue = await Promise.all([request(`/documents/${doc.id}/issue`, 'POST'), request(`/documents/${doc.id}/issue`, 'POST')]);
  assert.deepEqual(issue.map((r) => r.status).sort(), [200, 409]);
  const cancel = await Promise.all([request(`/documents/${doc.id}/cancel`, 'POST', {}), request(`/documents/${doc.id}/cancel`, 'POST', {})]);
  assert.deepEqual(cancel.map((r) => r.status).sort(), [200, 409]);
  const stock = await pool.query('SELECT count(*)::int AS n, sum(quantity)::numeric AS total FROM stock_movements WHERE document_id=$1', [doc.id]);
  assert.equal(stock.rows[0].n, 2);
  assert.equal(Number(stock.rows[0].total), 0);
});

test('stale price batches fail without overwriting current prices', async () => {
  const old = (await request('/products/product')).body;
  await new Promise((resolve) => setTimeout(resolve, 5));
  const update = (price) => request('/products/bulk', 'PATCH', { updates: [{ id: 'product', unitPrice: price, expectedUpdatedAt: old.updatedAt }] });
  assert.equal((await update(200)).status, 200);
  assert.equal((await update(900)).status, 409);
  assert.equal((await request('/products/product')).body.unitPrice, 200);
});

test('warehouse cannot edit sales documents', async () => {
  const doc = await draft('INVOICE');
  assert.equal((await request(`/documents/${doc.id}`, 'PUT', { items: items(8) }, 'WAREHOUSE')).status, 403);
});

test('paged document queries normalize Persian search and clamp pages', async () => {
  const doc = await draft('INVOICE');
  await request(`/documents/${doc.id}`, 'PUT', { buyerName: 'علی کریمی' });
  const result = await request(`/documents/page?type=INVOICE&q=${encodeURIComponent('علي كريمي')}&page=999&pageSize=1`);
  assert.equal(result.status, 200);
  assert.equal(result.body.total, 1);
  assert.equal(result.body.page, 1);
  assert.equal(result.body.rows[0].id, doc.id);
  assert.equal((await request('/documents/page?pageSize=1000')).status, 400);
  assert.equal((await request('/documents/page?from=2026-09-16&to=2026-09-01')).status, 400);
});


test('issued proforma revisions preserve the original and retries reuse the draft', async () => {
  const original = await draft();
  await request(`/documents/${original.id}`, 'PUT', { notes: 'Keep these notes', buyerName: 'Original buyer', items: items(3) });
  await request(`/documents/${original.id}/issue`, 'POST');
  const before = (await request(`/documents/${original.id}`)).body;
  const revisions = await Promise.all(Array.from({length: 4}, () => request(`/documents/${original.id}/revise`, 'POST')));
  assert.ok(revisions.every((r) => r.status === 201));
  assert.equal(new Set(revisions.map((r) => r.body.id)).size, 1);
  const revision = revisions[0].body;
  assert.equal(revision.revisionOfId, original.id);
  assert.equal(revision.status, 'DRAFT');
  assert.notEqual(revision.number, original.number);
  assert.equal(revision.notes, before.notes);
  assert.equal(revision.buyerName, before.buyerName);
  assert.equal(revision.items[0].quantity, 3);
  assert.equal((await request(`/documents/${revision.id}`, 'PUT', { items: items(8), expectedUpdatedAt: revision.updatedAt })).status, 200);
  const unchanged = (await request(`/documents/${original.id}`)).body;
  assert.equal(unchanged.items[0].quantity, 3);
  assert.equal(unchanged.updatedAt, before.updatedAt);
  assert.equal(unchanged.revisions[0].id, revision.id);
  assert.equal((await request(`/documents/${original.id}`, 'PUT', {items:items(99)})).status, 409);
  const invoice = await draft('INVOICE');
  await request(`/documents/${invoice.id}/issue`, 'POST');
  assert.equal((await request(`/documents/${invoice.id}/revise`, 'POST')).status, 409);
});

test('per-user permissions deny direct reads and writes, filter lists, and allow explicit grants', async () => {
  const doc = await draft();
  const denied = { proforma: 'none', products: 'none', inventory: 'none' };
  assert.equal((await request(`/documents/${doc.id}`, 'GET', undefined, 'SALES', denied)).status, 403);
  assert.equal((await request(`/documents/${doc.id}`, 'PUT', {items:items(9)}, 'SALES', denied)).status, 403);
  assert.equal((await request('/products', 'GET', undefined, 'SALES', denied)).status, 403);
  assert.equal((await request('/inventory/stock', 'GET', undefined, 'SALES', denied)).status, 403);
  const list = await request('/documents', 'GET', undefined, 'SALES', denied);
  assert.ok(list.body.every((d) => d.type !== 'PROFORMA'));
  const page = await request('/documents/page', 'GET', undefined, 'SALES', denied);
  assert.ok(page.body.rows.every((d) => d.type !== 'PROFORMA'));
  assert.equal((await request('/documents/page?type=PROFORMA', 'GET', undefined, 'SALES', denied)).status, 403);
  assert.equal((await request('/products/product','PUT',{unitPrice:101},'SALES',{products:'view'})).status,403);
  assert.equal((await request('/products/product','PUT',{unitPrice:100,brand:'BANA'},'SALES',{products:'edit'})).status,200);
  assert.equal((await request('/documents','POST',{type:'PROFORMA',items:items()},'WAREHOUSE',{proforma:'edit'})).status,201);
  await request(`/documents/${doc.id}/issue`, 'POST');
  assert.equal((await request(`/documents/${doc.id}/convert`,'POST',{to:'INVOICE'},'SALES',denied)).status,403);
  assert.equal((await request(`/documents/${doc.id}/revise`,'POST',{},'SALES',denied)).status,403);
  assert.equal((await request('/users','GET',undefined,'SALES',{company:'edit'})).status,403);
});

test('admin saves partial permissions and resets passwords without returning secrets', async () => {
  const created = await request('/users','POST',{fullName:'Permission test',username:'permissions_test',role:'SALES',password:'OriginalPass42!',permissions:{products:'edit',invoice:'none'}});
  assert.equal(created.status,201);
  assert.deepEqual(created.body.permissions,{products:'edit',invoice:'none'});
  const id = created.body.id;
  await pool.query("INSERT INTO sessions(id,user_id,expires_at) VALUES('test-session',$1,now()+interval '1 day')",[id]);
  const reset = await request(`/users/${id}`,'PUT',{password:'Replacement42!',permissions:{inventory:'view'}});
  assert.equal(reset.status,200);
  assert.deepEqual(reset.body.permissions,{inventory:'view'});
  assert.ok(!JSON.stringify(reset.body).includes('Replacement42!'));
  assert.ok(!('password_hash' in reset.body));
  const stored = (await pool.query('SELECT password_hash FROM users WHERE id=$1',[id])).rows[0];
  assert.equal(await verifyPassword('Replacement42!',stored.password_hash),true);
  assert.equal(await verifyPassword('OriginalPass42!',stored.password_hash),false);
  assert.equal((await pool.query('SELECT id FROM sessions WHERE user_id=$1',[id])).rowCount,0);
  assert.equal((await request(`/users/${id}`,'PUT',{permissions:{products:'owner'}})).status,400);
});


test('company settings are restricted while authorized documents can load seller metadata', async () => {
  assert.equal((await request('/company','GET',undefined,'SALES',{company:'none'})).status,403);
  assert.equal((await request('/documents/company','GET',undefined,'SALES',{company:'none'})).status,200);
  assert.equal((await request('/documents/company','GET',undefined,'SALES',{proforma:'none',invoice:'none',goods_issue:'none'})).status,403);
});

test('brand survives create, edit, and imports without clearing unspecified brands', async () => {
  const data={code:'BRAND-TEST',name:'Brand product',category:'GYPSUM_PANEL',unit:'sheet',unitPrice:100,brand:'ROYA'};
  const created=await request('/products','POST',data);
  assert.equal(created.status,201);assert.equal(created.body.brand,'ROYA');
  const id=created.body.id;
  assert.equal((await request(`/products/${id}`,'PUT',{brand:'GBOARD'})).body.brand,'GBOARD');
  const {brand,...legacy}=data;
  assert.equal((await request('/products/import','POST',{rows:[legacy]})).status,200);
  assert.equal((await request(`/products/${id}`)).body.brand,'GBOARD');
  assert.equal((await request('/products/import','POST',{rows:[data]})).status,200);
  assert.equal((await request(`/products/${id}`)).body.brand,'ROYA');
});
