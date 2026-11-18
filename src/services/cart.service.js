import * as cartRepository from '../repositories/cart.repository.js';
import * as productRepository from '../repositories/product.repository.js';
import { ShoppingCartException, ErrorType } from './service-error.js';

/**
 * @typedef {import('../repositories/cart.repository.js').Cart} Cart
 * @typedef {import('../repositories/cart.repository.js').CartItem} CartItem
 * @typedef {import('../repositories/product.repository.js').Product} Product
 */

/**
 * @typedef {Object} CartLine
 * @property {string} productId ID del producto.
 * @property {string} title Título del producto.
 * @property {string} imageUrl Imagen del producto.
 * @property {number} price Precio por unidad.
 * @property {number} quantity Cantidad en el carrito.
 * @property {number} subtotal price × quantity.
 */

/**
 * @typedef {Object} CartDetail
 * @property {string} user Usuario dueño del carrito.
 * @property {CartLine[]} items Entradas enriquecidas con los datos del producto.
 * @property {number} totalItems Suma de cantidades.
 * @property {number} total Suma de subtotales.
 */

/**
 * Redondea un importe a dos decimales.
 * @param {number} value Importe.
 * @returns {number}
 */
const roundMoney = (value) => Math.round(value * 100) / 100;

/**
 * Valida una cantidad (_validateAmount de la Práctica 2).
 * Además de no negativa, ahora debe ser entera, porque son unidades de un producto.
 * @param {*} quantity Cantidad recibida.
 * @returns {void}
 * @throws {ShoppingCartException} 400 si no es un entero mayor o igual a 0.
 */
const validateQuantity = (quantity) => {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ShoppingCartException('La cantidad debe ser un número entero y no negativo', ErrorType.VALIDATION, { quantity });
  }
};

/**
 * Busca la entrada de un producto en el carrito (_findProxy de la Práctica 2).
 * @param {Cart} cart Carrito.
 * @param {string} productId ID del producto.
 * @returns {CartItem|undefined}
 */
const findItem = (cart, productId) => cart.items.find((item) => item.productId === productId);

/**
 * Obtiene un producto del catálogo o lanza 404.
 * @param {string} productId ID del producto.
 * @returns {Promise<Product>}
 * @throws {ShoppingCartException} 404 si no existe.
 */
const requireProduct = async (productId) => {
  const product = await productRepository.findById(productId);
  if (!product) {
    throw new ShoppingCartException(`No existe un producto con ID ${productId}`, ErrorType.NOT_FOUND, { productId });
  }
  return product;
};

/**
 * Regla nueva de la Práctica 3: la cantidad del carrito no puede superar las existencias.
 * @param {Product} product Producto.
 * @param {number} requested Cantidad total solicitada.
 * @throws {ShoppingCartException} 409 si no hay existencias suficientes.
 */
const ensureStock = (product, requested) => {
  if (requested > product.stock) {
    throw new ShoppingCartException('No hay existencias suficientes', ErrorType.CONFLICT, {
      productId: product.id,
      stock: product.stock,
      requested
    });
  }
};

/**
 * Carga el carrito guardado de un usuario o uno vacío si todavía no existe.
 * @param {string} user Usuario normalizado.
 * @returns {Promise<Cart>}
 */
const loadCart = async (user) => (await cartRepository.findByUser(user)) ?? { user, items: [] };

/**
 * Calcula el total sumando cantidad × precio de cada entrada (calcularTotal de la Práctica 2).
 * @param {CartLine[]} lines Entradas con su subtotal.
 * @returns {number}
 */
const calcularTotal = (lines) => roundMoney(lines.reduce((total, line) => total + line.subtotal, 0));

/**
 * Enriquece las entradas del carrito con los datos actuales de cada producto y calcula los totales.
 * Igual que en la Práctica 2, el carrito sólo guarda referencias (productId y quantity).
 * @param {Cart} cart Carrito con IDs y cantidades.
 * @returns {Promise<CartDetail>}
 */
const toDetail = async (cart) => {
  const products = await productRepository.findAll();
  const byId = new Map(products.map((product) => [product.id, product]));

  const items = cart.items
    .filter((item) => byId.has(item.productId))
    .map((item) => {
      const { title, imageUrl, price } = byId.get(item.productId);
      return {
        productId: item.productId,
        title,
        imageUrl,
        price,
        quantity: item.quantity,
        subtotal: roundMoney(price * item.quantity)
      };
    });

  return {
    user: cart.user,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    total: calcularTotal(items)
  };
};

/**
 * Obtiene el carrito completo del usuario.
 * @param {string} user Usuario normalizado.
 * @returns {Promise<CartDetail>}
 */
export const getCart = async (user) => toDetail(await loadCart(user));

/**
 * Agrega un producto al carrito; si ya estaba, suma la cantidad sin duplicar la entrada (addItem de la Práctica 2).
 * @param {string} user Usuario normalizado.
 * @param {{productId?: string, quantity?: number}} data Producto y cantidad a sumar (1 por defecto).
 * @returns {Promise<CartDetail>}
 * @throws {ShoppingCartException} 400 si los datos son inválidos, 404 si el producto no existe, 409 si no hay existencias.
 */
export const addItem = async (user, { productId, quantity = 1 } = {}) => {
  if (typeof productId !== 'string' || productId.trim() === '') {
    throw new ShoppingCartException('productId es obligatorio y debe ser texto', ErrorType.VALIDATION);
  }
  validateQuantity(quantity);
  if (quantity === 0) {
    throw new ShoppingCartException('La cantidad a agregar debe ser mayor que cero', ErrorType.VALIDATION, { quantity });
  }

  const id = productId.trim();
  const product = await requireProduct(id);
  const cart = await loadCart(user);
  const item = findItem(cart, id);

  ensureStock(product, (item?.quantity ?? 0) + quantity);

  if (item) item.quantity += quantity;
  else cart.items.push({ productId: id, quantity });

  await cartRepository.save(cart);
  return toDetail(cart);
};

/**
 * Elimina una entrada del carrito (removeItem de la Práctica 2).
 * @param {string} user Usuario normalizado.
 * @param {string} productId ID del producto.
 * @returns {Promise<CartDetail>}
 * @throws {ShoppingCartException} 404 si el producto no está en el carrito.
 */
export const removeItem = async (user, productId) => {
  const cart = await loadCart(user);
  const index = cart.items.findIndex((item) => item.productId === productId);
  if (index === -1) {
    throw new ShoppingCartException(`El producto ${productId} no está en el carrito`, ErrorType.NOT_FOUND, { productId });
  }

  cart.items.splice(index, 1);
  await cartRepository.save(cart);
  return toDetail(cart);
};

/**
 * Cambia la cantidad de una entrada; si la nueva cantidad es 0, la elimina (updateItem de la Práctica 2).
 * @param {string} user Usuario normalizado.
 * @param {string} productId ID del producto.
 * @param {{quantity?: number}} data Nueva cantidad.
 * @returns {Promise<CartDetail>}
 * @throws {ShoppingCartException} 400 si la cantidad es inválida, 404 si el producto no está en el carrito, 409 si no hay existencias.
 */
export const updateItem = async (user, productId, { quantity } = {}) => {
  validateQuantity(quantity);

  const cart = await loadCart(user);
  const item = findItem(cart, productId);
  if (!item) {
    throw new ShoppingCartException(`El producto ${productId} no está en el carrito`, ErrorType.NOT_FOUND, { productId });
  }

  if (quantity === 0) return removeItem(user, productId);

  const product = await requireProduct(productId);
  ensureStock(product, quantity);
  item.quantity = quantity;

  await cartRepository.save(cart);
  return toDetail(cart);
};
