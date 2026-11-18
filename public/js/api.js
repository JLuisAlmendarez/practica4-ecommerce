/** @type {string} Usuario de prueba que identifica el carrito del ejercicio; no es autenticación. */
export const CART_USER = 'ana';

/**
 * @typedef {Object} Product
 * @property {string} id ID del producto generado por el servidor.
 * @property {string} title Título.
 * @property {string} description Descripción.
 * @property {string} category Categoría.
 * @property {number} price Precio por unidad.
 * @property {number} stock Existencias disponibles.
 * @property {string} imageUrl URL de la imagen.
 */

/**
 * @typedef {Object} ProductPage
 * @property {Product[]} data Productos de la página.
 * @property {{page: number, limit: number, totalPages: number}} pagination Datos de paginación.
 * @property {number} total Total de productos.
 */

/**
 * @typedef {Object} CartLine
 * @property {string} productId ID del producto.
 * @property {string} title Título del producto.
 * @property {string} imageUrl Imagen del producto.
 * @property {number} price Precio por unidad confirmado por el servidor.
 * @property {number} quantity Cantidad.
 * @property {number} subtotal price × quantity calculado por el servidor.
 */

/**
 * @typedef {Object} Cart
 * @property {string} user Usuario dueño del carrito.
 * @property {CartLine[]} items Entradas del carrito.
 * @property {number} totalItems Suma de cantidades.
 * @property {number} total Suma de subtotales.
 */

/**
 * Error de una solicitud HTTP. status vale 0 cuando no hubo respuesta del servidor (fallo de red).
 * @extends Error
 */
export class ApiError extends Error {
  /**
   * @param {number} status Código HTTP, o 0 si no hubo respuesta.
   * @param {string} message Mensaje del servidor o del cliente.
   * @param {Object} [details] Detalles que envió el servidor.
   */
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  /** @returns {boolean} true si conviene ofrecer Reintentar: fallo de red o error 5xx. */
  get retryable() {
    return this.status === 0 || this.status >= 500;
  }
}

/**
 * Lee el cuerpo de error de una respuesta sin fallar si no es JSON.
 * @param {Response} response Respuesta HTTP con error.
 * @returns {Promise<{error?: string, details?: Object}>}
 */
const readErrorBody = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

/**
 * Envía una solicitud con fetch y regresa el JSON de la respuesta.
 * Comprueba response.ok, no lee JSON cuando la respuesta es 204 y convierte los fallos de red en ApiError con status 0.
 * @param {string} path Ruta relativa, por ejemplo /api/products.
 * @param {{method?: string, body?: Object, headers?: Record<string, string>}} [options] Opciones de la solicitud.
 * @returns {Promise<any>} JSON de la respuesta, o null si es 204.
 * @throws {ApiError}
 */
export const request = async (path, { method = 'GET', body, headers = {} } = {}) => {
  const init = { method, headers: { Accept: 'application/json', ...headers } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor');
  }

  if (!response.ok) {
    const { error, details } = await readErrorBody(response);
    throw new ApiError(response.status, error ?? `Error HTTP ${response.status}`, details);
  }

  if (response.status === 204) return null;
  return response.json();
};

/** @type {Record<string, string>} Header que identifica el carrito del usuario de prueba. */
const CART_HEADERS = { 'x-user': CART_USER };

/**
 * GET /api/products con paginación.
 * @param {{page?: number, limit?: number, search?: string}} [query] Página, tamaño y búsqueda opcional.
 * @returns {Promise<ProductPage>}
 */
export const getProducts = ({ page = 1, limit = 4, search = '' } = {}) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) params.set('search', search.trim());
  return request(`/api/products?${params}`);
};

/**
 * POST /api/products.
 * @param {Omit<Product, 'id'>} data Datos del producto.
 * @returns {Promise<Product>}
 */
export const createProduct = (data) => request('/api/products', { method: 'POST', body: data });

/**
 * PUT /api/products/:id.
 * @param {string} id ID del producto.
 * @param {Omit<Product, 'id'>} data Datos del producto.
 * @returns {Promise<Product>}
 */
export const updateProduct = (id, data) => request(`/api/products/${encodeURIComponent(id)}`, { method: 'PUT', body: data });

/**
 * DELETE /api/products/:id; el servidor responde 204.
 * @param {string} id ID del producto.
 * @returns {Promise<null>}
 */
export const deleteProduct = (id) => request(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });

/**
 * GET /api/cart del usuario de prueba.
 * @returns {Promise<Cart>}
 */
export const getCart = () => request('/api/cart', { headers: CART_HEADERS });

/**
 * POST /api/cart/items: agrega un producto o incrementa su cantidad.
 * @param {string} productId ID real del producto.
 * @param {number} quantity Cantidad entera positiva.
 * @returns {Promise<Cart>}
 */
export const addCartItem = (productId, quantity) =>
  request('/api/cart/items', { method: 'POST', headers: CART_HEADERS, body: { productId, quantity } });

/**
 * PATCH /api/cart/items/:productId: cambia la cantidad de una entrada.
 * @param {string} productId ID del producto.
 * @param {number} quantity Nueva cantidad.
 * @returns {Promise<Cart>}
 */
export const updateCartItem = (productId, quantity) =>
  request(`/api/cart/items/${encodeURIComponent(productId)}`, { method: 'PATCH', headers: CART_HEADERS, body: { quantity } });

/**
 * DELETE /api/cart/items/:productId: elimina una entrada del carrito.
 * @param {string} productId ID del producto.
 * @returns {Promise<Cart|null>}
 */
export const removeCartItem = (productId) =>
  request(`/api/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE', headers: CART_HEADERS });

/**
 * Traduce un ApiError al mensaje que se muestra junto a la operación, según el código HTTP.
 * @param {ApiError|Error} error Error capturado.
 * @returns {string}
 */
export const describeError = (error) => {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado. Intenta de nuevo.';
  const { status, details } = error;

  if (status === 0) return 'No se pudo conectar con el servidor. Revisa tu conexión y reintenta.';
  if (status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en unos momentos.';
  if (status === 409) {
    const stock = details?.stock;
    return Number.isInteger(stock)
      ? `No hay existencias suficientes: solo quedan ${stock} unidades disponibles.`
      : 'No hay existencias suficientes para esa cantidad.';
  }
  if (status === 404) return 'El producto ya no existe. Actualiza el catálogo.';
  if (status === 400) return `Dato inválido: ${error.message}.`;
  return error.message;
};
