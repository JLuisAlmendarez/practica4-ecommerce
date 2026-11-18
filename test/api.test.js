import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {string} Carpeta temporal con una copia de los datos iniciales, para no modificar data/. */
const dataDir = await mkdtemp(join(tmpdir(), 'practica4-'));
for (const name of ['products.json', 'carts.json']) {
  await copyFile(fileURLToPath(new URL(`../data/seed/${name}`, import.meta.url)), join(dataDir, name));
}
process.env.DATA_DIR = dataDir;

const { default: app } = await import('../src/app.js');

/** @type {import('node:http').Server} */
let server;
/** @type {string} */
let base;

/** @type {string} Figura de Asuka, stock 5. */
const ASUKA = '3f6c2a8e-5b1d-4f7a-9c2e-1a8b7d6e5f40';
/** @type {string} Pase para convención, stock 3. */
const PASE = 'b3e8c1f5-7a4d-4b2e-9f6a-1c9d5e8b2a37';

/**
 * Hace una solicitud al servidor de prueba.
 * @param {string} path Ruta.
 * @param {{method?: string, body?: Object, user?: string|null}} [options] Método, body y usuario.
 * @returns {Promise<{status: number, body: any, type: string|null}>}
 */
const call = async (path, { method = 'GET', body, user = 'ana' } = {}) => {
  const headers = {};
  if (user) headers['x-user'] = user;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = response.headers.get('content-type');
  const text = await response.text();
  return { status: response.status, type, body: type?.includes('json') && text ? JSON.parse(text) : text };
};

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
});

test('Express sirve las páginas, los scripts externos y las librerías locales', async () => {
  const index = await call('/');
  assert.equal(index.status, 200);
  assert.match(index.type, /text\/html/);
  assert.match(index.body, /<script type="module" src="js\/catalog\.js"><\/script>/);
  for (const path of ['/shopping-cart.html', '/js/api.js', '/js/storage.js', '/js/cart.js', '/css/estilos.css', '/vendor/bootstrap/css/bootstrap.min.css', '/vendor/fontawesome/css/all.min.css']) {
    assert.equal((await call(path)).status, 200, path);
  }
  assert.deepEqual((await call('/health')).body, { status: 'ok' });
});

test('el catálogo tiene al menos cinco productos y se pagina de cuatro en cuatro', async () => {
  const first = await call('/api/products?page=1&limit=4');
  assert.equal(first.status, 200);
  assert.equal(first.body.data.length, 4);
  assert.deepEqual(first.body.pagination, { page: 1, limit: 4, totalPages: 3 });
  assert.ok(first.body.total >= 5);

  const last = await call('/api/products?page=3&limit=4');
  assert.equal(last.body.data.length, 1);

  const ids = new Set([...first.body.data, ...(await call('/api/products?page=2&limit=4')).body.data, ...last.body.data].map((p) => p.id));
  assert.equal(ids.size, first.body.total);
});

test('el carrito requiere x-user y empieza vacío', async () => {
  assert.equal((await call('/api/cart', { user: null })).status, 400);
  const cart = await call('/api/cart');
  assert.deepEqual(cart.body, { user: 'ana', items: [], totalItems: 0, total: 0 });
});

test('agregar dos veces el mismo producto incrementa una sola entrada', async () => {
  assert.equal((await call('/api/cart/items', { method: 'POST', body: { productId: ASUKA, quantity: 2 } })).status, 200);
  const second = await call('/api/cart/items', { method: 'POST', body: { productId: ASUKA, quantity: 1 } });
  assert.equal(second.body.items.length, 1);
  assert.equal(second.body.items[0].quantity, 3);
  assert.equal(second.body.items[0].subtotal, 5697);
  assert.equal(second.body.total, 5697);
});

test('los errores del carrito responden 400, 404 y 409 sin guardar cambios', async () => {
  assert.equal((await call('/api/cart/items', { method: 'POST', body: { productId: ASUKA, quantity: 1.5 } })).status, 400);
  assert.equal((await call('/api/cart/items', { method: 'POST', body: { productId: 'no-existe', quantity: 1 } })).status, 404);
  const conflict = await call('/api/cart/items', { method: 'POST', body: { productId: ASUKA, quantity: 3 } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.details.stock, 5);
  assert.equal((await call(`/api/cart/items/${ASUKA}`, { method: 'PATCH', body: { quantity: -1 } })).status, 400);
  assert.equal((await call(`/api/cart/items/${ASUKA}`, { method: 'PATCH', body: { quantity: 99 } })).status, 409);
  assert.equal((await call('/api/cart')).body.items[0].quantity, 3);
});

test('PATCH cambia la cantidad, PATCH 0 y DELETE eliminan la entrada', async () => {
  const patched = await call(`/api/cart/items/${ASUKA}`, { method: 'PATCH', body: { quantity: 4 } });
  assert.equal(patched.body.items[0].quantity, 4);
  assert.equal(patched.body.total, 7596);

  await call('/api/cart/items', { method: 'POST', body: { productId: PASE, quantity: 3 } });
  const zero = await call(`/api/cart/items/${PASE}`, { method: 'PATCH', body: { quantity: 0 } });
  assert.deepEqual(zero.body.items.map((item) => item.productId), [ASUKA]);

  const removed = await call(`/api/cart/items/${ASUKA}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.total, 0);
  assert.equal((await call(`/api/cart/items/${ASUKA}`, { method: 'DELETE' })).status, 404);
});
