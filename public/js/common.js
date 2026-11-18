import { bindCartLinks, syncCartBadge } from './cart-sync.js';
import { FALLBACK_IMAGE } from './ui.js';

/**
 * Valida los formularios de Bootstrap marcados con .needs-validation (inicio de sesión y registro de la Práctica 1).
 * Si son válidos cierra el modal y limpia el formulario; no envía datos porque la autenticación está fuera del alcance.
 * @returns {void}
 */
const bindValidatedForms = () => {
  for (const form of document.querySelectorAll('.needs-validation')) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }
      const modalElement = form.closest('.modal');
      if (modalElement) globalThis.bootstrap.Modal.getInstance(modalElement)?.hide();
      form.classList.remove('was-validated');
      form.reset();
    });
  }
};

/**
 * Conecta el buscador de la barra de navegación. En el catálogo filtra sin recargar; en otras páginas lleva al catálogo.
 * @param {((search: string) => void)|undefined} onSearch Acción de búsqueda de la página actual.
 * @returns {void}
 */
const bindSearch = (onSearch) => {
  const form = document.getElementById('search-form');
  if (!form) return;
  const input = form.querySelector('input[name="search"]');
  const current = new URLSearchParams(window.location.search).get('search');
  if (current && onSearch) input.value = current;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const search = input.value.trim();
    if (onSearch) onSearch(search);
    else window.location.href = search ? `index.html?search=${encodeURIComponent(search)}#catalogo` : 'index.html#catalogo';
  });
};

/**
 * Sustituye por la imagen local las imágenes estáticas de la página (logo, carrusel, pedidos) que no carguen.
 * @returns {void}
 */
const bindImageFallbacks = () => {
  for (const img of document.querySelectorAll('img')) {
    const fallback = () => {
      if (img.closest('.carousel-item')) img.classList.add('sin-imagen');
      else if (!img.src.endsWith(FALLBACK_IMAGE)) img.src = FALLBACK_IMAGE;
    };
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fallback();
    else img.addEventListener('error', fallback, { once: true });
  }
};

/**
 * Inicializa lo que comparten todas las páginas: enlaces e indicador del carrito, buscador y formularios.
 * @param {{onSearch?: (search: string) => void, syncBadge?: boolean}} [options] Búsqueda propia y si se sincroniza el indicador.
 * @returns {void}
 */
export const initPage = ({ onSearch, syncBadge = true } = {}) => {
  bindImageFallbacks();
  bindCartLinks();
  bindSearch(onSearch);
  bindValidatedForms();
  if (syncBadge) syncCartBadge();
};
