import * as cartService from '../services/cart.service.js';

/**
 * GET /api/cart — carrito completo del usuario con subtotales y total.
 * @param {import('express').Request} req Solicitud; req.user lo asigna validate-cart-user.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const getCart = async (req, res) => {
  const cart = await cartService.getCart(req.user);
  res.status(200).json(cart);
};

/**
 * POST /api/cart/items — agrega un producto o incrementa su cantidad.
 * @param {import('express').Request} req Solicitud con { productId, quantity } en el body.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const addItem = async (req, res) => {
  const { productId, quantity } = req.body ?? {};
  const cart = await cartService.addItem(req.user, { productId, quantity });
  res.status(200).json(cart);
};

/**
 * PATCH /api/cart/items/:productId — cambia la cantidad de una entrada (0 la elimina).
 * @param {import('express').Request} req Solicitud con { quantity } en el body.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const updateItem = async (req, res) => {
  const { quantity } = req.body ?? {};
  const cart = await cartService.updateItem(req.user, req.params.productId, { quantity });
  res.status(200).json(cart);
};

/**
 * DELETE /api/cart/items/:productId — elimina una entrada del carrito.
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 * @returns {Promise<void>}
 */
export const removeItem = async (req, res) => {
  const cart = await cartService.removeItem(req.user, req.params.productId);
  res.status(200).json(cart);
};
