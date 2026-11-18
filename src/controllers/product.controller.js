import * as productService from '../services/product.service.js';

/**
 * GET /api/products — listado con filtros (search, category, minPrice, maxPrice) y paginación (page, limit).
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const list = async (req, res) => {
  const { search, category, minPrice, maxPrice, page, limit } = req.query;
  const result = await productService.list({ search, category, minPrice, maxPrice, page, limit });
  res.status(200).json(result);
};

/**
 * GET /api/products/:id — detalle de un producto.
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const getById = async (req, res) => {
  const product = await productService.getById(req.params.id);
  res.status(200).json(product);
};

/**
 * POST /api/products — crea un producto; responde 201 y Location.
 * @param {import('express').Request} req Solicitud con el body ya validado.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const create = async (req, res) => {
  const product = await productService.create(req.body);
  res.status(201).location(`/api/products/${product.id}`).json(product);
};

/**
 * PUT /api/products/:id — reemplaza los datos de un producto.
 * @param {import('express').Request} req Solicitud con el body ya validado.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const update = async (req, res) => {
  const product = await productService.update(req.params.id, req.body);
  res.status(200).json(product);
};

/**
 * DELETE /api/products/:id — elimina un producto; responde 204 sin contenido.
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const remove = async (req, res) => {
  await productService.remove(req.params.id);
  res.status(204).end();
};
