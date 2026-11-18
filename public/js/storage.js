import { CART_USER } from './api.js';

/** @type {string} Clave de sessionStorage con la copia del último carrito confirmado por el servidor. */
export const CART_KEY = `ecommerce.cart.${CART_USER}`;

/**
 * Regresa el sessionStorage del navegador, o null si no está disponible.
 * @returns {Storage|null}
 */
const storage = () => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Revisa que un valor tenga la forma mínima de un carrito de la API.
 * @param {*} value Valor leído.
 * @returns {boolean}
 */
const isCart = (value) =>
  value !== null &&
  typeof value === 'object' &&
  Array.isArray(value.items) &&
  Number.isFinite(value.total) &&
  Number.isInteger(value.totalItems);

/**
 * Guarda la copia local de un carrito que ya confirmó el servidor.
 * @param {import('./api.js').Cart} cart Respuesta de GET /api/cart.
 * @returns {void}
 */
export const saveCart = (cart) => {
  try {
    storage()?.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    return;
  }
};

/**
 * Lee la copia local del carrito. Una clave ausente, un JSON dañado o un objeto con otra forma regresan null.
 * @returns {import('./api.js').Cart|null}
 */
export const readCart = () => {
  let raw;
  try {
    raw = storage()?.getItem(CART_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const cart = JSON.parse(raw);
    if (isCart(cart)) return cart;
  } catch {
    clearCart();
    return null;
  }
  clearCart();
  return null;
};

/**
 * Elimina la copia local del carrito.
 * @returns {void}
 */
export const clearCart = () => {
  try {
    storage()?.removeItem(CART_KEY);
  } catch {
    return;
  }
};
