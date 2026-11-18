import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveCart, readCart, clearCart, CART_KEY } from '../public/js/storage.js';
import { request, getCart, addCartItem, describeError, ApiError } from '../public/js/api.js';
import { validateQuantity, parseEditedQuantity, totalsMatch } from '../public/js/validation.js';

/**
 * sessionStorage en memoria para probar storage.js fuera del navegador.
 * @implements {Storage}
 */
class MemoryStorage {
  #data = new Map();

  /** @param {string} key */
  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }

  /** @param {string} key @param {string} value */
  setItem(key, value) {
    this.#data.set(key, String(value));
  }

  /** @param {string} key */
  removeItem(key) {
    this.#data.delete(key);
  }
}

/** @type {import('../public/js/api.js').Cart} */
const CART = {
  user: 'ana',
  items: [
    { productId: 'a', title: 'Figura', imageUrl: 'https://example.com/a.jpg', price: 1899, quantity: 3, subtotal: 5697 },
    { productId: 'b', title: 'Pase', imageUrl: 'https://example.com/b.jpg', price: 780, quantity: 2, subtotal: 1560 }
  ],
  totalItems: 5,
  total: 7257
};

/** @type {typeof fetch} */
const realFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.sessionStorage = new MemoryStorage();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.sessionStorage;
});

test('storage guarda y lee la copia con JSON bajo ecommerce.cart.ana', () => {
  assert.equal(CART_KEY, 'ecommerce.cart.ana');
  saveCart(CART);
  assert.equal(globalThis.sessionStorage.getItem(CART_KEY), JSON.stringify(CART));
  assert.deepEqual(readCart(), CART);
  clearCart();
  assert.equal(readCart(), null);
});

test('storage regresa null con la clave ausente, JSON dañado u otra forma, sin lanzar errores', () => {
  assert.equal(readCart(), null);
  globalThis.sessionStorage.setItem(CART_KEY, '{dañado');
  assert.equal(readCart(), null);
  assert.equal(globalThis.sessionStorage.getItem(CART_KEY), null);
  globalThis.sessionStorage.setItem(CART_KEY, JSON.stringify({ items: 'x' }));
  assert.equal(readCart(), null);
  delete globalThis.sessionStorage;
  assert.doesNotThrow(() => saveCart(CART));
  assert.equal(readCart(), null);
});

test('request comprueba response.ok y convierte el error del servidor en ApiError', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'No hay existencias suficientes', details: { stock: 3 } }), { status: 409, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(addCartItem('b', 9), (error) => error instanceof ApiError && error.status === 409 && error.details.stock === 3);
});

test('request no lee JSON en una respuesta 204', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await request('/api/products/x', { method: 'DELETE' }), null);
});

test('request envía x-user, Content-Type y el body sin precios calculados en el navegador', async () => {
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, init };
    return new Response(JSON.stringify(CART), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  await addCartItem('a', 2);
  assert.equal(sent.url, '/api/cart/items');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.headers['x-user'], 'ana');
  assert.equal(sent.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sent.init.body), { productId: 'a', quantity: 2 });
  assert.deepEqual(await getCart(), CART);
});

test('un fallo de red produce ApiError con status 0 y opción de reintentar', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(getCart(), (error) => error instanceof ApiError && error.status === 0 && error.retryable);
});

test('describeError traduce cada código HTTP a un mensaje para la interfaz', () => {
  assert.match(describeError(new ApiError(400, 'La cantidad debe ser un número entero y no negativo')), /^Dato inválido/);
  assert.match(describeError(new ApiError(404, 'No existe')), /ya no existe/);
  assert.match(describeError(new ApiError(409, 'x', { stock: 2 })), /solo quedan 2/);
  assert.match(describeError(new ApiError(500, 'x')), /servidor tuvo un problema/);
  assert.match(describeError(new ApiError(0, 'x')), /No se pudo conectar/);
  assert.equal(new ApiError(409, 'x').retryable, false);
  assert.equal(new ApiError(503, 'x').retryable, true);
});

test('validateQuantity acepta enteros positivos dentro del stock', () => {
  assert.deepEqual(validateQuantity('2', 5), { quantity: 2 });
  assert.deepEqual(validateQuantity(' 5 ', 5), { quantity: 5 });
  for (const value of ['', '0', '-1', '1.5', 'abc', '1e2', '6']) {
    assert.ok(validateQuantity(value, 5).error, value);
  }
});

test('parseEditedQuantity rechaza vacío, decimales y negativos y admite 0 para eliminar', () => {
  assert.deepEqual(parseEditedQuantity('0'), { quantity: 0 });
  assert.deepEqual(parseEditedQuantity('4'), { quantity: 4 });
  assert.match(parseEditedQuantity('-1').error, /negativa/);
  assert.match(parseEditedQuantity('1.5').error, /decimales/);
  assert.match(parseEditedQuantity('').error, /Escribe/);
});

test('totalsMatch comprueba subtotales, total y unidades confirmados por el servidor', () => {
  assert.equal(totalsMatch(CART), true);
  assert.equal(totalsMatch({ ...CART, total: 1 }), false);
  assert.equal(totalsMatch({ ...CART, totalItems: 9 }), false);
});
