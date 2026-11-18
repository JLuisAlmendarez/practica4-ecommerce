import { readFile, writeFile } from 'node:fs/promises';
import { dataFile } from './data-dir.js';

/** @type {string} Ruta del archivo que persiste los carritos. */
const FILE = dataFile('carts.json');

/**
 * @typedef {Object} CartItem
 * @property {string} productId ID del producto.
 * @property {number} quantity Cantidad, entero mayor que 0.
 */

/**
 * @typedef {Object} Cart
 * @property {string} user Usuario de prueba dueño del carrito.
 * @property {CartItem[]} items Entradas del carrito.
 */

/**
 * Lee todos los carritos del archivo JSON.
 * @returns {Promise<Cart[]>}
 */
export const findAll = async () => {
  const content = await readFile(FILE, 'utf8');
  return content.trim() ? JSON.parse(content) : [];
};

/**
 * Busca el carrito de un usuario.
 * @param {string} user Usuario normalizado.
 * @returns {Promise<Cart|undefined>}
 */
export const findByUser = async (user) => {
  const carts = await findAll();
  return carts.find((cart) => cart.user === user);
};

/**
 * Sobrescribe todos los carritos en el archivo JSON.
 * @param {Cart[]} carts Carritos a guardar.
 * @returns {Promise<void>}
 */
export const saveAll = async (carts) => {
  await writeFile(FILE, `${JSON.stringify(carts, null, 2)}\n`, 'utf8');
};

/**
 * Guarda el carrito de un usuario, creándolo si no existe.
 * @param {Cart} cart Carrito a guardar.
 * @returns {Promise<Cart>}
 */
export const save = async (cart) => {
  const carts = await findAll();
  const index = carts.findIndex((item) => item.user === cart.user);
  if (index === -1) carts.push(cart);
  else carts[index] = cart;
  await saveAll(carts);
  return cart;
};
