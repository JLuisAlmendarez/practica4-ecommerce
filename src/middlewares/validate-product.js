import { ProductException } from '../services/service-error.js';

/** @type {string[]} Atributos que pertenecen a un producto; el id siempre lo genera el servidor. */
const ATTRIBUTES = ['title', 'description', 'category', 'price', 'stock', 'imageUrl'];

/**
 * Regresa un objeto nuevo sólo con las propiedades que pertenecen a un producto.
 * Igual que Product.cleanObject de la Práctica 2: acepta nombres con o sin guion bajo
 * (title o _title) y descarta el id y cualquier campo extra.
 * @param {Object} obj Objeto recibido en el body.
 * @returns {Object} Objeto limpio.
 */
const cleanObject = (obj) => {
  const clean = {};
  for (const key of Object.keys(obj)) {
    const name = key.startsWith('_') ? key.slice(1) : key;
    if (ATTRIBUTES.includes(name)) clean[name] = obj[key];
  }
  return clean;
};

/**
 * Valida que un valor sea un texto con contenido (requireText de la Práctica 2).
 * @param {*} value Valor a revisar.
 * @returns {boolean}
 */
const isFilledText = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Valida una URL de imagen con la misma regla del setter imageUrl de la Práctica 2.
 * @param {string} value URL recibida.
 * @returns {string|null} Mensaje de error o null si es válida.
 */
const imageUrlError = (value) => {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return 'La URL de la imagen no es válida';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'La URL de la imagen debe usar http o https';
  }
  return null;
};

/**
 * Valida el body de POST y PUT de productos antes de llegar al controlador.
 * Reutiliza las reglas de la clase Product de la Práctica 2, con dos ajustes que pide la Práctica 3:
 * price debe ser mayor que 0 y stock debe ser un entero.
 * Deja en req.body sólo los datos limpios del producto.
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 * @param {import('express').NextFunction} next Siguiente middleware.
 */
const validateProduct = (req, res, next) => {
  const body = req.body;

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return next(new ProductException('El cuerpo debe ser un objeto JSON con los datos del producto'));
  }

  const data = cleanObject(body);
  const errors = {};

  if (!isFilledText(data.title)) errors.title = 'El título no puede estar vacío';
  if (!isFilledText(data.description)) errors.description = 'La descripción no puede estar vacía';
  if (!isFilledText(data.category)) errors.category = 'La categoría no puede estar vacía';

  if (!isFilledText(data.imageUrl)) {
    errors.imageUrl = 'La URL de la imagen no puede estar vacía';
  } else {
    const message = imageUrlError(data.imageUrl);
    if (message) errors.imageUrl = message;
  }

  if (typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price <= 0) {
    errors.price = 'El precio debe ser un número mayor que 0';
  }
  if (!Number.isInteger(data.stock) || data.stock < 0) {
    errors.stock = 'El stock debe ser un entero mayor o igual a 0';
  }

  if (Object.keys(errors).length > 0) {
    return next(new ProductException('Datos de producto inválidos', undefined, errors));
  }

  req.body = {
    title: data.title.trim(),
    description: data.description.trim(),
    category: data.category.trim(),
    price: data.price,
    stock: data.stock,
    imageUrl: new URL(data.imageUrl.trim()).href
  };
  next();
};

export default validateProduct;
