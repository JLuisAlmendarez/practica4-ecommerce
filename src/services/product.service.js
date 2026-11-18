import { v4 as uuidv4 } from 'uuid';
import * as productRepository from '../repositories/product.repository.js';
import * as cartRepository from '../repositories/cart.repository.js';
import { ProductException, ErrorType } from './service-error.js';

/** @type {number} Página por defecto del listado. */
const DEFAULT_PAGE = 1;
/** @type {number} Productos por página por defecto. */
const DEFAULT_LIMIT = 8;
/** @type {number} Máximo de productos por página. */
const MAX_LIMIT = 50;

/**
 * @typedef {import('../repositories/product.repository.js').Product} Product
 */

/**
 * @typedef {Object} ProductQuery
 * @property {string} [search] Texto a buscar en el título.
 * @property {string} [category] Texto a buscar en la categoría.
 * @property {string} [minPrice] Precio mínimo.
 * @property {string} [maxPrice] Precio máximo.
 * @property {string} [page] Página solicitada.
 * @property {string} [limit] Productos por página.
 */

/**
 * @typedef {Object} ProductPage
 * @property {Product[]} data Productos de la página solicitada.
 * @property {{page: number, limit: number, totalPages: number}} pagination Datos de paginación.
 * @property {number} total Total de productos que cumplen los filtros.
 */

/**
 * Quita acentos, espacios sobrantes y mayúsculas para comparar textos.
 * Es la misma función normalize de ProductsService en la Práctica 2.
 * @param {string} text Texto a normalizar.
 * @returns {string}
 * @example
 * normalize('  Electrónica '); // 'electronica'
 */
const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Convierte un parámetro de query en número.
 * @param {string|undefined} value Valor recibido.
 * @param {string} name Nombre del parámetro, para el mensaje de error.
 * @param {{integer?: boolean, min?: number}} rules Reglas que debe cumplir.
 * @returns {number|undefined} undefined si el parámetro no se envió.
 * @throws {ProductException} 400 si el valor no cumple las reglas.
 */
const parseNumber = (value, name, { integer = false, min = 0 } = {}) => {
  if (value === undefined || value === '') return undefined;
  const number = Number(value);
  const valid = Number.isFinite(number) && (!integer || Number.isInteger(number)) && number >= min;
  if (!valid) {
    const kind = integer ? 'un entero' : 'un número';
    throw new ProductException(`${name} debe ser ${kind} mayor o igual a ${min}`, ErrorType.VALIDATION, { [name]: value });
  }
  return number;
};

/**
 * Lista productos con filtros opcionales combinables y paginación.
 * La búsqueda conserva las reglas de findProduct de la Práctica 2: coincidencias parciales
 * en título y categoría, sin distinguir mayúsculas ni acentos; una consulta vacía regresa todo.
 * @param {ProductQuery} query Parámetros de búsqueda.
 * @returns {Promise<ProductPage>}
 * @throws {ProductException} 400 si algún parámetro numérico es inválido.
 */
export const list = async (query = {}) => {
  const minPrice = parseNumber(query.minPrice, 'minPrice');
  const maxPrice = parseNumber(query.maxPrice, 'maxPrice');
  const page = parseNumber(query.page, 'page', { integer: true, min: 1 }) ?? DEFAULT_PAGE;
  const limit = parseNumber(query.limit, 'limit', { integer: true, min: 1 }) ?? DEFAULT_LIMIT;

  if (limit > MAX_LIMIT) {
    throw new ProductException(`limit no puede ser mayor que ${MAX_LIMIT}`, ErrorType.VALIDATION, { limit: query.limit });
  }
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new ProductException('minPrice no puede ser mayor que maxPrice', ErrorType.VALIDATION, { minPrice, maxPrice });
  }

  const title = normalize(query.search ?? '');
  const category = normalize(query.category ?? '');
  const products = await productRepository.findAll();

  const filtered = products.filter((product) =>
    normalize(product.category).includes(category) &&
    normalize(product.title).includes(title) &&
    (minPrice === undefined || product.price >= minPrice) &&
    (maxPrice === undefined || product.price <= maxPrice)
  );

  const start = (page - 1) * limit;
  return {
    data: filtered.slice(start, start + limit),
    pagination: { page, limit, totalPages: Math.ceil(filtered.length / limit) },
    total: filtered.length
  };
};

/**
 * Busca un producto por su ID (getProductByID de la Práctica 2).
 * @param {string} id ID del producto.
 * @returns {Promise<Product>}
 * @throws {ProductException} 404 si no existe.
 */
export const getById = async (id) => {
  const product = await productRepository.findById(id);
  if (!product) {
    throw new ProductException(`No existe un producto con ID ${id}`, ErrorType.NOT_FOUND, { id });
  }
  return product;
};

/**
 * Crea un producto (createProduct de la Práctica 2). El ID siempre lo genera el servidor.
 * @param {Omit<Product, 'id'>} data Datos validados del producto.
 * @returns {Promise<Product>}
 */
export const create = async (data) => {
  const product = { id: uuidv4(), ...data };
  return productRepository.create(product);
};

/**
 * Reemplaza los datos de un producto sin cambiar su ID (updateProduct de la Práctica 2).
 * @param {string} id ID del producto.
 * @param {Omit<Product, 'id'>} data Datos validados del producto.
 * @returns {Promise<Product>}
 * @throws {ProductException} 404 si no existe.
 */
export const update = async (id, data) => {
  const updated = await productRepository.update({ id, ...data });
  if (!updated) {
    throw new ProductException(`No existe un producto con ID ${id}`, ErrorType.NOT_FOUND, { id });
  }
  return updated;
};

/**
 * Elimina un producto (deleteProduct de la Práctica 2) y retira sus entradas de todos los carritos.
 * @param {string} id ID del producto.
 * @returns {Promise<void>}
 * @throws {ProductException} 404 si no existe.
 */
export const remove = async (id) => {
  const removed = await productRepository.remove(id);
  if (!removed) {
    throw new ProductException(`No existe un producto con ID ${id}`, ErrorType.NOT_FOUND, { id });
  }

  const carts = await cartRepository.findAll();
  const cleaned = carts.map((cart) => ({
    ...cart,
    items: cart.items.filter((item) => item.productId !== id)
  }));
  await cartRepository.saveAll(cleaned);
};
