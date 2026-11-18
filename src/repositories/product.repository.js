import { readFile, writeFile } from 'node:fs/promises';
import { dataFile } from './data-dir.js';

/** @type {string} Ruta del archivo que persiste el catálogo. */
const FILE = dataFile('products.json');

/**
 * @typedef {Object} Product
 * @property {string} id UUID generado por el servidor.
 * @property {string} title Título del producto.
 * @property {string} description Descripción del producto.
 * @property {string} category Categoría del producto.
 * @property {number} price Precio por unidad, mayor que 0.
 * @property {number} stock Existencias disponibles, entero mayor o igual a 0.
 * @property {string} imageUrl URL de la imagen.
 */

/**
 * Lee todos los productos del archivo JSON.
 * @returns {Promise<Product[]>}
 */
export const findAll = async () => {
  const content = await readFile(FILE, 'utf8');
  return content.trim() ? JSON.parse(content) : [];
};

/**
 * Busca un producto por su ID.
 * @param {string} id ID del producto.
 * @returns {Promise<Product|undefined>}
 */
export const findById = async (id) => {
  const products = await findAll();
  return products.find((product) => product.id === id);
};

/**
 * Sobrescribe el catálogo completo en el archivo JSON.
 * @param {Product[]} products Catálogo a guardar.
 * @returns {Promise<void>}
 */
export const saveAll = async (products) => {
  await writeFile(FILE, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
};

/**
 * Agrega un producto al catálogo.
 * @param {Product} product Producto con ID asignado.
 * @returns {Promise<Product>}
 */
export const create = async (product) => {
  const products = await findAll();
  products.push(product);
  await saveAll(products);
  return product;
};

/**
 * Reemplaza un producto existente.
 * @param {Product} product Producto con los datos nuevos.
 * @returns {Promise<Product|undefined>} El producto guardado o undefined si no existe.
 */
export const update = async (product) => {
  const products = await findAll();
  const index = products.findIndex((item) => item.id === product.id);
  if (index === -1) return undefined;
  products[index] = product;
  await saveAll(products);
  return product;
};

/**
 * Elimina un producto por su ID.
 * @param {string} id ID del producto.
 * @returns {Promise<boolean>} true si se eliminó.
 */
export const remove = async (id) => {
  const products = await findAll();
  const remaining = products.filter((product) => product.id !== id);
  if (remaining.length === products.length) return false;
  await saveAll(remaining);
  return true;
};
