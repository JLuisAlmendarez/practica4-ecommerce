/**
 * Valida la cantidad del modal del catálogo: entero mayor que cero que no supere las existencias.
 * @param {string} raw Valor del campo.
 * @param {number} stock Existencias del producto.
 * @returns {{quantity?: number, error?: string}}
 * @example
 * validateQuantity('2', 5); // { quantity: 2 }
 * validateQuantity('1.5', 5); // { error: '…' }
 */
export const validateQuantity = (raw, stock) => {
  const text = String(raw ?? '').trim();
  if (text === '') return { error: 'Escribe una cantidad.' };
  if (!/^\d+$/.test(text)) return { error: 'La cantidad debe ser un número entero positivo, sin decimales ni signos.' };
  const quantity = Number(text);
  if (quantity <= 0) return { error: 'La cantidad debe ser mayor que cero.' };
  if (quantity > stock) return { error: `Solo hay ${stock} unidades en existencia.` };
  return { quantity };
};

/**
 * Valida la nueva cantidad de una entrada del carrito. Vacío, decimales y negativos son inválidos; 0 significa eliminar.
 * @param {string} raw Valor del campo.
 * @returns {{quantity?: number, error?: string}}
 */
export const parseEditedQuantity = (raw) => {
  const text = String(raw ?? '').trim();
  if (text === '') return { error: 'Escribe una cantidad.' };
  if (/^-/.test(text)) return { error: 'La cantidad no puede ser negativa.' };
  if (!/^\d+$/.test(text)) return { error: 'La cantidad debe ser un número entero, sin decimales.' };
  return { quantity: Number(text) };
};

/**
 * Comprueba que subtotales, total y unidades coincidan con precio × cantidad. El servidor sigue siendo la autoridad.
 * @param {import('./api.js').Cart} cart Carrito confirmado por el servidor.
 * @returns {boolean}
 */
export const totalsMatch = (cart) => {
  const cents = (value) => Math.round(value * 100);
  const linesOk = cart.items.every((item) => cents(item.price * item.quantity) === cents(item.subtotal));
  const total = cart.items.reduce((sum, item) => sum + cents(item.subtotal), 0);
  const units = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  return linesOk && total === cents(cart.total) && units === cart.totalItems;
};
