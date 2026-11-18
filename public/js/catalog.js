import { getProducts, addCartItem, describeError, ApiError } from './api.js';
import { readCart } from './storage.js';
import { refreshCart } from './cart-sync.js';
import { initPage } from './common.js';
import { validateQuantity } from './validation.js';
import { el, icon, productImage, setImageSource, formatMoney, setBusy, showToast, alertBox, loadingBox } from './ui.js';

/** @type {number} Productos por página que se solicitan al servidor. */
const PAGE_SIZE = 4;

/**
 * Estado del catálogo en pantalla.
 * @type {{page: number, totalPages: number, search: string, products: Map<string, import('./api.js').Product>, loading: boolean}}
 */
const state = {
  page: 1,
  totalPages: 0,
  search: new URLSearchParams(window.location.search).get('search') ?? '',
  products: new Map(),
  loading: false
};

/** @type {{status: HTMLElement, list: HTMLElement, pagination: HTMLElement, pageInfo: HTMLElement, heading: HTMLElement}} */
const view = {
  status: document.getElementById('catalog-status'),
  list: document.getElementById('product-list'),
  pagination: document.getElementById('pagination'),
  pageInfo: document.getElementById('page-info'),
  heading: document.getElementById('catalog-heading')
};

/** @type {HTMLElement} */
const modalElement = document.getElementById('modalCantidad');
/** @type {HTMLFormElement} */
const quantityForm = document.getElementById('quantity-form');
/** @type {HTMLInputElement} */
const quantityInput = document.getElementById('quantity-input');
/** @type {HTMLElement} */
const quantityError = document.getElementById('quantity-error');
/** @type {HTMLButtonElement} */
const confirmButton = document.getElementById('quantity-confirm');
/** @type {HTMLButtonElement} */
const refreshButton = document.getElementById('quantity-refresh');

/** @type {import('./api.js').Product|null} Producto elegido en el modal. */
let selected = null;

/**
 * Crea la tarjeta de un producto. El botón guarda el ID real del producto en data-product-id.
 * @param {import('./api.js').Product} product Producto del servidor.
 * @returns {HTMLElement}
 */
const productCard = (product) => {
  const available = product.stock > 0;
  const button = available
    ? el('button', { className: 'btn btn-primary w-100', attrs: { type: 'button' }, dataset: { productId: product.id } },
      icon('fa-solid fa-cart-plus me-2'), document.createTextNode('Agregar al carrito'))
    : el('button', { className: 'btn btn-secondary w-100', text: 'Sin existencias', attrs: { type: 'button', disabled: true } });

  return el('div', { className: 'col-12 col-sm-6 col-lg-3' },
    el('article', { className: 'card producto shadow-sm h-100', dataset: { productCard: product.id } },
      productImage(product.imageUrl, product.title, 'card-img-top'),
      el('div', { className: 'card-body d-flex flex-column' },
        el('span', { className: 'badge text-bg-light border align-self-start mb-2', text: product.category }),
        el('h2', { className: 'card-title h5', text: product.title }),
        el('p', { className: 'card-text text-secondary small', text: product.description }),
        el('p', { className: 'precio mb-1', text: formatMoney(product.price) }),
        el('p', {
          className: `small mb-3 ${available ? 'text-success' : 'text-danger'}`,
          text: available ? `${product.stock} en existencia` : 'Sin existencias'
        }),
        el('div', { className: 'mt-auto' }, button)
      )
    )
  );
};

/**
 * Crea un elemento de la paginación de Bootstrap.
 * @param {string} label Texto del enlace.
 * @param {number} page Página a la que lleva.
 * @param {{disabled?: boolean, active?: boolean, ariaLabel?: string}} [options] Estado del elemento.
 * @returns {HTMLElement}
 */
const pageItem = (label, page, { disabled = false, active = false, ariaLabel } = {}) =>
  el('li', { className: `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}` },
    el('button', {
      className: 'page-link',
      text: label,
      attrs: { type: 'button', disabled, 'aria-current': active ? 'page' : false, 'aria-label': ariaLabel ?? false },
      dataset: { page: String(page) }
    }));

/**
 * Dibuja la paginación según page y totalPages; Anterior y Siguiente se deshabilitan en los límites.
 * @returns {void}
 */
const renderPagination = () => {
  const { page, totalPages, loading } = state;
  if (totalPages <= 0) {
    view.pagination.replaceChildren();
    view.pageInfo.textContent = '';
    return;
  }
  const items = [pageItem('Anterior', page - 1, { disabled: loading || page <= 1 })];
  for (let number = 1; number <= totalPages; number += 1) {
    items.push(pageItem(String(number), number, { active: number === page, disabled: loading, ariaLabel: `Página ${number}` }));
  }
  items.push(pageItem('Siguiente', page + 1, { disabled: loading || page >= totalPages }));
  view.pagination.replaceChildren(...items);
  view.pageInfo.textContent = `Página ${page} de ${totalPages}`;
};

/**
 * Consulta una página del catálogo y reemplaza las tarjetas anteriores.
 * @param {number} page Página solicitada.
 * @returns {Promise<void>}
 */
const loadPage = async (page) => {
  state.loading = true;
  renderPagination();
  view.list.setAttribute('aria-busy', 'true');
  view.status.replaceChildren(loadingBox('Cargando productos…'));

  try {
    const result = await getProducts({ page, limit: PAGE_SIZE, search: state.search });
    const { totalPages } = result.pagination;

    if (totalPages > 0 && page > totalPages) {
      state.loading = false;
      await loadPage(totalPages);
      return;
    }

    state.page = result.pagination.page;
    state.totalPages = totalPages;
    state.products = new Map(result.data.map((product) => [product.id, product]));
    view.list.replaceChildren(...result.data.map(productCard));

    if (result.data.length === 0) {
      const message = state.search
        ? `No hay productos que coincidan con «${state.search}».`
        : 'El catálogo está vacío por ahora. Vuelve pronto.';
      view.status.replaceChildren(alertBox('info', message, state.search ? { label: 'Ver todo el catálogo', action: 'clear-search' } : undefined));
    } else {
      view.status.replaceChildren();
    }
  } catch (error) {
    view.list.replaceChildren();
    state.products = new Map();
    state.totalPages = 0;
    view.status.replaceChildren(alertBox('danger', `No se pudo cargar el catálogo. ${describeError(error)}`, { label: 'Reintentar', action: 'retry' }));
  } finally {
    state.loading = false;
    view.list.removeAttribute('aria-busy');
    renderPagination();
  }
};

/**
 * Muestra un mensaje de error dentro del modal de cantidad.
 * @param {string} message Mensaje; cadena vacía para ocultarlo.
 * @returns {void}
 */
const setQuantityError = (message) => {
  quantityError.textContent = message;
  quantityError.classList.toggle('d-none', message === '');
  quantityInput.classList.toggle('is-invalid', message !== '');
};

/**
 * Abre el modal de cantidad con los datos del producto elegido.
 * @param {import('./api.js').Product} product Producto.
 * @returns {void}
 */
const openQuantityModal = (product) => {
  selected = product;
  const inCart = readCart()?.items.find((item) => item.productId === product.id)?.quantity ?? 0;

  setImageSource(modalElement.querySelector('[data-modal-image]'), product.imageUrl, product.title);
  modalElement.querySelector('[data-modal-title]').textContent = product.title;
  modalElement.querySelector('[data-modal-price]').textContent = formatMoney(product.price);
  modalElement.querySelector('[data-modal-stock]').textContent = `${product.stock} en existencia`;
  modalElement.querySelector('[data-modal-incart]').textContent = inCart > 0 ? `Ya tienes ${inCart} en tu carrito.` : '';
  modalElement.querySelector('[data-modal-id]').textContent = product.id;

  quantityForm.reset();
  quantityInput.value = '1';
  quantityInput.max = String(product.stock);
  setQuantityError('');
  refreshButton.classList.add('d-none');
  confirmButton.disabled = false;

  globalThis.bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

/**
 * Envía POST /api/cart/items; si el servidor confirma, consulta GET /api/cart y guarda la respuesta en sessionStorage.
 * Ante un error conserva el estado anterior y muestra el motivo en el modal.
 * @param {SubmitEvent} event Envío del formulario del modal.
 * @returns {Promise<void>}
 */
const submitQuantity = async (event) => {
  event.preventDefault();
  if (!selected || confirmButton.dataset.busy === 'true') return;

  const { quantity, error } = validateQuantity(quantityInput.value, selected.stock);
  if (error) {
    setQuantityError(error);
    quantityInput.focus();
    return;
  }

  setQuantityError('');
  setBusy(confirmButton, true, 'Agregando…');
  quantityInput.readOnly = true;
  try {
    await addCartItem(selected.id, quantity);
    const cart = await refreshCart();
    globalThis.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    const line = cart.items.find((item) => item.productId === selected.id);
    showToast(`Agregaste ${quantity} × ${selected.title}. En tu carrito: ${line?.quantity ?? quantity}.`);
  } catch (failure) {
    setQuantityError(describeError(failure));
    if (failure instanceof ApiError && failure.status === 404) refreshButton.classList.remove('d-none');
  } finally {
    setBusy(confirmButton, false);
    quantityInput.readOnly = false;
  }
};

view.list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-product-id]');
  if (!button) return;
  const product = state.products.get(button.dataset.productId);
  if (product) openQuantityModal(product);
});

view.pagination.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-page]');
  if (!button || button.disabled || state.loading) return;
  const page = Number(button.dataset.page);
  if (page < 1 || page > state.totalPages || page === state.page) return;
  loadPage(page);
  view.heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

view.status.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'retry') loadPage(state.page);
  if (action === 'clear-search') {
    state.search = '';
    document.querySelector('#search-form input[name="search"]').value = '';
    window.history.replaceState(null, '', window.location.pathname);
    loadPage(1);
  }
});

quantityForm.addEventListener('submit', submitQuantity);
quantityInput.addEventListener('input', () => setQuantityError(''));

refreshButton.addEventListener('click', () => {
  globalThis.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
  loadPage(state.page);
});

modalElement.addEventListener('hidden.bs.modal', () => {
  selected = null;
});

initPage({
  onSearch: (search) => {
    state.search = search;
    const url = search ? `?search=${encodeURIComponent(search)}` : window.location.pathname;
    window.history.replaceState(null, '', url);
    loadPage(1);
    view.heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

loadPage(1);
