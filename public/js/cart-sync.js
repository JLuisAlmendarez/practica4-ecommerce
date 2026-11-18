import { getCart } from './api.js';
import { saveCart, readCart } from './storage.js';
import { updateCartBadge } from './ui.js';

/**
 * Consulta GET /api/cart, reemplaza la copia de sessionStorage y actualiza el indicador.
 * El servidor es la fuente oficial: la copia local solo guarda su última respuesta confirmada.
 * @returns {Promise<import('./api.js').Cart>}
 * @throws {import('./api.js').ApiError} Si la consulta falla; en ese caso la copia local no cambia.
 */
export const refreshCart = async () => {
  const cart = await getCart();
  saveCart(cart);
  updateCartBadge(cart.totalItems);
  return cart;
};

/**
 * Muestra en el indicador la copia local, si existe, y después la sustituye con la respuesta del servidor.
 * @returns {Promise<void>}
 */
export const syncCartBadge = async () => {
  const cached = readCart();
  if (cached) updateCartBadge(cached.totalItems);
  try {
    await refreshCart();
  } catch {
    return;
  }
};

/**
 * Hace que los enlaces del carrito consulten GET /api/cart y actualicen sessionStorage antes de navegar.
 * Si la consulta falla también se navega: la vista del carrito muestra el aviso correspondiente.
 * @returns {void}
 */
export const bindCartLinks = () => {
  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a[data-cart-link]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (link.getAttribute('aria-busy') === 'true') return;
    link.setAttribute('aria-busy', 'true');
    try {
      await refreshCart();
    } catch {
      link.removeAttribute('aria-busy');
    }
    window.location.href = link.getAttribute('href');
  });
};
