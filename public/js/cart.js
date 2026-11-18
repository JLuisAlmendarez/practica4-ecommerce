import { updateCartItem, removeCartItem, describeError } from './api.js';
import { readCart } from './storage.js';
import { refreshCart } from './cart-sync.js';
import { initPage } from './common.js';
import { parseEditedQuantity, totalsMatch } from './validation.js';
import { el, icon, productImage, formatMoney, setBusy, showToast, alertBox, loadingBox, confirmDialog, updateCartBadge } from './ui.js';

/**
 * Estado de la vista del carrito.
 * @type {{cart: import('./api.js').Cart|null, stale: boolean, syncing: boolean, editing: string|null, errors: Map<string, {message: string, retry?: 'delete'|'update'}>, busy: Set<string>}}
 */
const state = {
  cart: null,
  stale: false,
  syncing: true,
  editing: null,
  errors: new Map(),
  busy: new Set()
};

/** @type {{status: HTMLElement, list: HTMLElement, summary: HTMLElement}} */
const view = {
  status: document.getElementById('cart-status'),
  list: document.getElementById('cart-items'),
  summary: document.getElementById('cart-summary')
};

/**
 * Crea los botones de una entrada según su modo: lectura (Editar, Eliminar) o edición (Confirmar, Cancelar).
 * @param {import('./api.js').CartLine} item Entrada.
 * @param {boolean} editing true si la entrada está en edición.
 * @param {boolean} locked true si no se permiten modificaciones.
 * @returns {HTMLElement}
 */
const lineActions = (item, editing, locked) => {
  const disabled = locked || state.busy.has(item.productId);
  const button = (label, action, className, symbol) => el('button', {
    className: `btn btn-sm ${className}`,
    attrs: { type: 'button', disabled, 'aria-label': `${label} ${item.title}` },
    dataset: { action, productId: item.productId }
  }, icon(`${symbol} me-1`), document.createTextNode(label));

  return el('div', { className: 'd-flex flex-wrap gap-2 justify-content-end' },
    ...(editing
      ? [button('Confirmar', 'confirm', 'btn-success', 'fa-solid fa-check'), button('Cancelar', 'cancel', 'btn-outline-secondary', 'fa-solid fa-xmark')]
      : [button('Editar', 'edit', 'btn-outline-primary', 'fa-solid fa-pen'), button('Eliminar', 'delete', 'btn-outline-danger', 'fa-solid fa-trash')]));
};

/**
 * Crea la fila de una entrada del carrito con ID, imagen, nombre, precio, cantidad y subtotal.
 * @param {import('./api.js').CartLine} item Entrada confirmada por el servidor.
 * @returns {HTMLElement}
 */
const cartLine = (item) => {
  const editing = state.editing === item.productId;
  const error = state.errors.get(item.productId);
  const inputId = `qty-${item.productId}`;

  const input = el('input', {
    className: `form-control form-control-sm text-center${error && editing ? ' is-invalid' : ''}`,
    attrs: { id: inputId, type: 'number', min: '0', step: '1', inputmode: 'numeric', readonly: !editing, 'aria-readonly': String(!editing) },
    dataset: { quantityFor: item.productId, original: String(item.quantity) }
  });
  input.value = String(item.quantity);

  return el('div', { className: 'cart-line border-bottom py-3', dataset: { line: item.productId } },
    el('div', { className: 'row g-3 align-items-center' },
      el('div', { className: 'col-4 col-md-2' }, productImage(item.imageUrl, item.title, 'img-fluid rounded cart-img')),
      el('div', { className: 'col-8 col-md-4' },
        el('h2', { className: 'h6 mb-1', text: item.title }),
        el('p', { className: 'small text-secondary mb-1' }, document.createTextNode('ID: '), el('code', { text: item.productId })),
        el('p', { className: 'mb-0' }, el('span', { className: 'text-secondary small', text: 'Precio unitario: ' }), el('span', { text: formatMoney(item.price) }))
      ),
      el('div', { className: 'col-6 col-md-2' },
        el('label', { className: 'form-label small text-secondary mb-1', text: 'Cantidad', attrs: { for: inputId } }),
        input
      ),
      el('div', { className: 'col-6 col-md-2 text-md-end' },
        el('div', { className: 'small text-secondary', text: 'Subtotal' }),
        el('div', { className: 'fw-semibold', text: formatMoney(item.subtotal), dataset: { subtotalFor: item.productId } })
      ),
      el('div', { className: 'col-12 col-md-2' }, lineActions(item, editing, state.stale || state.syncing))
    ),
    error && el('div', { className: 'mt-2' },
      alertBox('danger', error.message, error.retry ? { label: 'Reintentar', action: `retry-${error.retry}` } : undefined))
  );
};

/**
 * Dibuja el resumen con el total confirmado por el servidor.
 * @param {import('./api.js').Cart} cart Carrito.
 * @returns {void}
 */
const renderSummary = (cart) => {
  const row = (label, value, attrs = {}) => el('div', { className: 'd-flex justify-content-between mb-2' }, el('span', { text: label }), el('span', { text: value, attrs }));
  view.summary.replaceChildren(
    el('h2', { className: 'h4 mb-3', text: 'Resumen de compra' }),
    row('Artículos', String(cart.totalItems), { 'data-summary-items': '' }),
    row('Envío', cart.total >= 999 ? 'Gratis' : 'Por calcular'),
    el('hr'),
    el('div', { className: 'd-flex justify-content-between align-items-baseline' },
      el('b', { text: 'Total' }),
      el('span', { className: 'precio', text: formatMoney(cart.total), attrs: { 'data-summary-total': '' } })),
    el('p', { className: 'small text-secondary mt-2 mb-3', text: 'Importes en pesos mexicanos (MXN) confirmados por el servidor.' }),
    el('button', { className: 'btn btn-primary w-100', text: 'Proceder al pago', attrs: { type: 'button', disabled: true, title: 'Los pagos no forman parte de esta práctica' } }),
    el('a', { className: 'btn btn-outline-secondary w-100 mt-2', text: 'Seguir comprando', attrs: { href: 'index.html#catalogo' } })
  );
};

/**
 * Dibuja todo el carrito a partir del estado actual.
 * @returns {void}
 */
const render = () => {
  const { cart } = state;
  if (!cart) return;
  updateCartBadge(cart.totalItems);

  if (cart.items.length === 0) {
    view.list.replaceChildren(el('div', { className: 'text-center py-5' },
      el('p', { className: 'display-6 mb-2' }, icon('fa-solid fa-cart-shopping text-secondary')),
      el('p', { className: 'lead', text: 'Tu carrito está vacío.' }),
      el('a', { className: 'btn btn-primary', text: 'Ir al catálogo', attrs: { href: 'index.html#catalogo' } })));
  } else {
    view.list.replaceChildren(...cart.items.map(cartLine));
  }
  renderSummary(cart);

  if (!state.stale && !totalsMatch(cart)) {
    view.status.replaceChildren(alertBox('warning', 'Los importes recibidos no coinciden con precio × cantidad; se muestran los valores del servidor.'));
  }
};

/**
 * Consulta GET /api/cart y reemplaza la vista y la copia local con la respuesta del servidor.
 * Si falla y existe copia local, la muestra con el aviso Datos sin actualizar y bloquea las modificaciones.
 * @returns {Promise<void>}
 */
const loadCart = async () => {
  state.syncing = true;
  view.status.replaceChildren(loadingBox(state.cart ? 'Actualizando con el servidor…' : 'Cargando carrito…'));
  try {
    state.cart = await refreshCart();
    state.stale = false;
    view.status.replaceChildren();
  } catch (error) {
    const cached = state.cart ?? readCart();
    if (!cached) {
      state.syncing = false;
      view.list.replaceChildren();
      view.summary.replaceChildren();
      view.status.replaceChildren(alertBox('danger', `No se pudo cargar el carrito. ${describeError(error)}`, { label: 'Reintentar', action: 'reload' }));
      return;
    }
    state.cart = cached;
    state.stale = true;
    state.editing = null;
    view.status.replaceChildren(alertBox('warning', `Datos sin actualizar: se muestra la última copia guardada en este navegador y las modificaciones están deshabilitadas. ${describeError(error)}`, { label: 'Reintentar', action: 'reload' }));
  }
  state.syncing = false;
  render();
};

/**
 * Ejecuta una modificación en el servidor y, si se confirma, vuelve a consultar el carrito.
 * Mientras tanto deshabilita los botones de la entrada; ante un error conserva el estado confirmado y muestra el motivo.
 * @param {string} productId ID de la entrada.
 * @param {() => Promise<unknown>} operation Solicitud PATCH o DELETE.
 * @param {'delete'|'update'} kind Tipo de operación, para ofrecer Reintentar.
 * @param {string} success Mensaje de éxito.
 * @returns {Promise<boolean>} true si el servidor confirmó el cambio.
 */
const mutate = async (productId, operation, kind, success) => {
  state.busy.add(productId);
  state.errors.delete(productId);
  const trigger = view.list.querySelector(`[data-line="${CSS.escape(productId)}"] [data-action="${kind === 'delete' ? 'delete' : 'confirm'}"]`);
  setBusy(trigger, true, kind === 'delete' ? 'Eliminando…' : 'Guardando…');
  for (const button of view.list.querySelectorAll(`[data-line="${CSS.escape(productId)}"] button`)) button.disabled = true;

  try {
    await operation();
  } catch (error) {
    state.busy.delete(productId);
    state.errors.set(productId, { message: describeError(error), retry: error.retryable ? kind : undefined });
    if (kind === 'update' && !error.retryable) state.editing = null;
    if (error.status === 404) state.cart = await refreshCart().catch(() => state.cart);
    render();
    return false;
  }

  state.busy.delete(productId);
  state.editing = null;
  try {
    state.cart = await refreshCart();
    state.stale = false;
    view.status.replaceChildren();
  } catch (error) {
    view.status.replaceChildren(alertBox('warning', `El cambio se guardó, pero no se pudo actualizar la vista. ${describeError(error)}`, { label: 'Reintentar', action: 'reload' }));
  }
  render();
  showToast(success);
  return true;
};

/**
 * Pide confirmación y elimina la entrada con DELETE. Cancelar no envía ninguna solicitud.
 * @param {import('./api.js').CartLine} item Entrada.
 * @param {string} [reason] Texto adicional del modal.
 * @returns {Promise<void>}
 */
const deleteLine = async (item, reason = '') => {
  const confirmed = await confirmDialog({
    title: 'Eliminar del carrito',
    message: `${reason}¿Quieres eliminar «${item.title}» de tu carrito?`
  });
  if (!confirmed) {
    if (state.editing === item.productId) {
      state.editing = null;
      render();
    }
    return;
  }
  await mutate(item.productId, () => removeCartItem(item.productId), 'delete', `Eliminaste «${item.title}» del carrito.`);
};

/**
 * Confirma la edición de la cantidad: valida, trata 0 como eliminación confirmada y envía PATCH con un entero positivo.
 * @param {import('./api.js').CartLine} item Entrada.
 * @returns {Promise<void>}
 */
const confirmEdit = async (item) => {
  const input = view.list.querySelector(`[data-quantity-for="${CSS.escape(item.productId)}"]`);
  const { quantity, error } = parseEditedQuantity(input.value);

  if (error) {
    state.errors.set(item.productId, { message: error });
    render();
    view.list.querySelector(`[data-quantity-for="${CSS.escape(item.productId)}"]`).value = input.value;
    return;
  }
  if (quantity === 0) {
    await deleteLine(item, 'La cantidad 0 elimina la entrada. ');
    return;
  }
  if (quantity === item.quantity) {
    state.editing = null;
    state.errors.delete(item.productId);
    render();
    return;
  }
  await mutate(item.productId, () => updateCartItem(item.productId, quantity), 'update', `Actualizaste «${item.title}» a ${quantity} unidades.`);
};

view.list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled || state.stale || state.syncing) return;
  const line = button.closest('[data-line]');
  const productId = button.dataset.productId ?? line?.dataset.line;
  const item = state.cart?.items.find((entry) => entry.productId === productId);
  if (!item || state.busy.has(productId)) return;

  switch (button.dataset.action) {
    case 'edit':
      state.editing = productId;
      state.errors.delete(productId);
      render();
      view.list.querySelector(`[data-quantity-for="${CSS.escape(productId)}"]`)?.focus();
      break;
    case 'cancel':
      state.editing = null;
      state.errors.delete(productId);
      render();
      break;
    case 'confirm':
      confirmEdit(item);
      break;
    case 'delete':
    case 'retry-delete':
      deleteLine(item);
      break;
    case 'retry-update':
      state.editing = productId;
      state.errors.delete(productId);
      render();
      break;
    default:
      break;
  }
});

view.list.addEventListener('keydown', (event) => {
  const input = event.target.closest('input[data-quantity-for]');
  if (!input || input.readOnly) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    view.list.querySelector(`[data-line="${CSS.escape(input.dataset.quantityFor)}"] [data-action="confirm"]`)?.click();
  }
  if (event.key === 'Escape') {
    view.list.querySelector(`[data-line="${CSS.escape(input.dataset.quantityFor)}"] [data-action="cancel"]`)?.click();
  }
});

view.status.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="reload"]')) loadCart();
});

initPage({ syncBadge: false });

const cached = readCart();
if (cached) {
  state.cart = cached;
  render();
}
loadCart();

