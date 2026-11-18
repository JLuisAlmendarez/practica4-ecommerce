import { getProducts, createProduct, updateProduct, deleteProduct, describeError, ApiError } from './api.js';
import { initPage } from './common.js';
import { el, icon, productImage, formatMoney, setBusy, showToast, alertBox, loadingBox, confirmDialog } from './ui.js';

/** @type {number} Productos por página en la tabla de administración. */
const PAGE_SIZE = 5;

/** @type {string[]} Campos del formulario, con los mismos nombres del contrato de la API. */
const FIELDS = ['title', 'description', 'category', 'price', 'stock', 'imageUrl'];

/** @type {{page: number, totalPages: number, products: Map<string, import('./api.js').Product>, editingId: string|null}} */
const state = { page: 1, totalPages: 0, products: new Map(), editingId: null };

/** @type {{status: HTMLElement, rows: HTMLElement, pagination: HTMLElement, total: HTMLElement}} */
const view = {
  status: document.getElementById('admin-status'),
  rows: document.getElementById('admin-rows'),
  pagination: document.getElementById('admin-pagination'),
  total: document.getElementById('admin-total')
};

/** @type {HTMLElement} */
const modalElement = document.getElementById('modalProducto');
/** @type {HTMLFormElement} */
const form = document.getElementById('product-form');
/** @type {HTMLElement} */
const formError = document.getElementById('product-form-error');
/** @type {HTMLButtonElement} */
const saveButton = document.getElementById('product-save');

/**
 * Valida los datos del formulario con las mismas reglas que validate-product en el servidor.
 * @param {FormData} data Datos del formulario.
 * @returns {{product: Omit<import('./api.js').Product, 'id'>, errors: Record<string, string>}}
 */
export const readProductForm = (data) => {
  const text = (name) => String(data.get(name) ?? '').trim();
  const errors = {};
  const product = {
    title: text('title'),
    description: text('description'),
    category: text('category'),
    price: Number(text('price')),
    stock: Number(text('stock')),
    imageUrl: text('imageUrl')
  };

  if (!product.title) errors.title = 'El título no puede estar vacío';
  if (!product.description) errors.description = 'La descripción no puede estar vacía';
  if (!product.category) errors.category = 'La categoría no puede estar vacía';
  if (text('price') === '' || !Number.isFinite(product.price) || product.price <= 0) errors.price = 'El precio debe ser un número mayor que 0';
  if (!/^\d+$/.test(text('stock'))) errors.stock = 'El stock debe ser un entero mayor o igual a 0';
  try {
    const url = new URL(product.imageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') errors.imageUrl = 'La URL de la imagen debe usar http o https';
  } catch {
    errors.imageUrl = 'La URL de la imagen no es válida';
  }
  return { product, errors };
};

/**
 * Marca los campos inválidos del formulario con el mensaje correspondiente.
 * @param {Record<string, string>} errors Mensajes por campo.
 * @returns {void}
 */
const showFieldErrors = (errors) => {
  for (const name of FIELDS) {
    const input = form.elements.namedItem(name);
    const feedback = form.querySelector(`[data-feedback-for="${name}"]`);
    const message = errors[name] ?? '';
    input.classList.toggle('is-invalid', message !== '');
    feedback.textContent = message;
  }
};

/**
 * Crea la fila de un producto en la tabla.
 * @param {import('./api.js').Product} product Producto.
 * @returns {HTMLElement}
 */
const productRow = (product) => el('tr', { dataset: { row: product.id } },
  el('td', {}, productImage(product.imageUrl, product.title, 'admin-thumb rounded')),
  el('td', {}, el('div', { className: 'fw-semibold', text: product.title }), el('code', { className: 'small', text: product.id })),
  el('td', { text: product.category }),
  el('td', { className: 'text-end', text: formatMoney(product.price) }),
  el('td', { className: 'text-end', text: String(product.stock) }),
  el('td', { className: 'text-end text-nowrap' },
    el('button', { className: 'btn btn-sm btn-outline-primary me-2', attrs: { type: 'button', 'aria-label': `Editar ${product.title}` }, dataset: { action: 'edit', id: product.id } }, icon('fa-solid fa-pen')),
    el('button', { className: 'btn btn-sm btn-outline-danger', attrs: { type: 'button', 'aria-label': `Eliminar ${product.title}` }, dataset: { action: 'delete', id: product.id } }, icon('fa-solid fa-trash')))
);

/**
 * Dibuja la paginación de la tabla.
 * @returns {void}
 */
const renderPagination = () => {
  const item = (label, page, disabled, active = false) => el('li', { className: `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}` },
    el('button', { className: 'page-link', text: label, attrs: { type: 'button', disabled }, dataset: { page: String(page) } }));
  if (state.totalPages <= 1) {
    view.pagination.replaceChildren();
    return;
  }
  const pages = Array.from({ length: state.totalPages }, (_, index) => item(String(index + 1), index + 1, false, index + 1 === state.page));
  view.pagination.replaceChildren(item('Anterior', state.page - 1, state.page <= 1), ...pages, item('Siguiente', state.page + 1, state.page >= state.totalPages));
};

/**
 * Consulta una página de productos y reemplaza las filas.
 * @param {number} page Página.
 * @returns {Promise<void>}
 */
const loadPage = async (page) => {
  view.status.replaceChildren(loadingBox('Cargando productos…'));
  try {
    const result = await getProducts({ page, limit: PAGE_SIZE });
    if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
      await loadPage(result.pagination.totalPages);
      return;
    }
    state.page = result.pagination.page;
    state.totalPages = result.pagination.totalPages;
    state.products = new Map(result.data.map((product) => [product.id, product]));
    view.rows.replaceChildren(...result.data.map(productRow));
    view.total.textContent = `${result.total} productos`;
    view.status.replaceChildren(result.data.length === 0 ? alertBox('info', 'No hay productos registrados.') : '');
  } catch (error) {
    view.rows.replaceChildren();
    view.status.replaceChildren(alertBox('danger', `No se pudo cargar el catálogo. ${describeError(error)}`, { label: 'Reintentar', action: 'retry' }));
  }
  renderPagination();
};

/**
 * Abre el formulario vacío para crear o con los datos del producto para editar.
 * @param {import('./api.js').Product|null} product Producto a editar, o null para crear.
 * @returns {void}
 */
const openForm = (product) => {
  state.editingId = product?.id ?? null;
  form.reset();
  showFieldErrors({});
  formError.classList.add('d-none');
  modalElement.querySelector('[data-form-title]').textContent = product ? 'Editar producto' : 'Nuevo producto';
  if (product) for (const name of FIELDS) form.elements.namedItem(name).value = String(product[name]);
  globalThis.bootstrap.Modal.getOrCreateInstance(modalElement).show();
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { product, errors } = readProductForm(new FormData(form));
  showFieldErrors(errors);
  formError.classList.add('d-none');
  if (Object.keys(errors).length > 0) return;

  setBusy(saveButton, true, 'Guardando…');
  try {
    if (state.editingId) await updateProduct(state.editingId, product);
    else await createProduct(product);
    globalThis.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    showToast(state.editingId ? `Guardaste los cambios de «${product.title}».` : `Creaste «${product.title}».`);
    await loadPage(state.editingId ? state.page : Math.max(1, Math.ceil((Number.parseInt(view.total.textContent, 10) + 1) / PAGE_SIZE)));
  } catch (error) {
    if (error instanceof ApiError && error.status === 400 && error.details) showFieldErrors(error.details);
    formError.textContent = describeError(error);
    formError.classList.remove('d-none');
  } finally {
    setBusy(saveButton, false);
  }
});

view.rows.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const product = state.products.get(button.dataset.id);
  if (!product) return;

  if (button.dataset.action === 'edit') {
    openForm(product);
    return;
  }

  const confirmed = await confirmDialog({
    title: 'Eliminar producto',
    message: `¿Eliminar «${product.title}» del catálogo? También se retirará de los carritos.`
  });
  if (!confirmed) return;
  setBusy(button, true, '');
  try {
    await deleteProduct(product.id);
    showToast(`Eliminaste «${product.title}».`);
    await loadPage(state.page);
  } catch (error) {
    setBusy(button, false);
    view.status.replaceChildren(alertBox('danger', `No se pudo eliminar «${product.title}». ${describeError(error)}`));
  }
});

view.pagination.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-page]');
  if (button && !button.disabled) loadPage(Number(button.dataset.page));
});

view.status.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry"]')) loadPage(state.page);
});

document.getElementById('product-new').addEventListener('click', () => openForm(null));

initPage();
loadPage(1);
