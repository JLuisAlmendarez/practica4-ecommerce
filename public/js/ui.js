/** @type {string} Imagen local que sustituye a una imagen remota que no cargó. */
export const FALLBACK_IMAGE = '/img/sin-imagen.svg';

/** @type {Intl.NumberFormat} Formato de importes en pesos mexicanos con dos decimales. */
const MONEY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Da formato a un importe con dos decimales y la etiqueta de la moneda.
 * @param {number} value Importe.
 * @returns {string}
 * @example
 * formatMoney(1899); // '$1,899.00 MXN'
 */
export const formatMoney = (value) => `${MONEY.format(value)} MXN`;

/**
 * Crea un elemento del DOM. El texto siempre se asigna con textContent para no interpretar HTML del servidor.
 * @param {string} tag Etiqueta HTML.
 * @param {{className?: string, text?: string|number, attrs?: Record<string, string|boolean>, dataset?: Record<string, string>}} [options] Clases, texto, atributos y data-*.
 * @param {...(Node|null|undefined|false)} children Hijos a insertar.
 * @returns {HTMLElement}
 */
export const el = (tag, { className, text, attrs = {}, dataset = {} } = {}, ...children) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : value);
  }
  Object.assign(node.dataset, dataset);
  for (const child of children) if (child) node.append(child);
  return node;
};

/**
 * Crea un ícono de Font Awesome decorativo.
 * @param {string} name Clases del ícono, por ejemplo 'fa-solid fa-trash'.
 * @returns {HTMLElement}
 */
export const icon = (name) => el('i', { className: name, attrs: { 'aria-hidden': 'true' } });

/**
 * Asigna la imagen de un producto; si la URL remota no carga, usa la imagen local.
 * @param {HTMLImageElement} img Imagen.
 * @param {string} src URL de la imagen.
 * @param {string} alt Texto alternativo.
 * @returns {HTMLImageElement}
 */
export const setImageSource = (img, src, alt) => {
  img.alt = alt;
  img.onerror = () => {
    img.onerror = null;
    img.src = FALLBACK_IMAGE;
  };
  img.src = src;
  return img;
};

/**
 * Crea una imagen de producto que cambia a la imagen local si la URL remota no carga.
 * @param {string} src URL de la imagen.
 * @param {string} alt Texto alternativo.
 * @param {string} className Clases CSS.
 * @returns {HTMLImageElement}
 */
export const productImage = (src, alt, className) =>
  setImageSource(el('img', { className, attrs: { loading: 'lazy' } }), src, alt);

/**
 * Deshabilita un botón mientras se procesa una operación y muestra un indicador; al terminar restaura su contenido.
 * @param {HTMLButtonElement} button Botón.
 * @param {boolean} busy true para deshabilitar.
 * @param {string} [label] Texto mientras se procesa.
 * @returns {void}
 */
export const setBusy = (button, busy, label = 'Procesando…') => {
  if (!button) return;
  if (busy) {
    if (button.dataset.busy === 'true') return;
    button.dataset.busy = 'true';
    button.dataset.wasDisabled = String(button.disabled);
    button.dataset.content = button.innerHTML;
    button.disabled = true;
    button.replaceChildren(
      el('span', { className: 'spinner-border spinner-border-sm me-1', attrs: { 'aria-hidden': 'true' } }),
      document.createTextNode(label)
    );
    return;
  }
  if (button.dataset.busy !== 'true') return;
  button.innerHTML = button.dataset.content;
  button.disabled = button.dataset.wasDisabled === 'true';
  delete button.dataset.busy;
  delete button.dataset.content;
  delete button.dataset.wasDisabled;
};

/**
 * Actualiza todos los indicadores del carrito de la barra de navegación.
 * @param {number} totalItems Total de unidades confirmado por el servidor.
 * @returns {void}
 */
export const updateCartBadge = (totalItems) => {
  for (const badge of document.querySelectorAll('[data-cart-count]')) {
    badge.textContent = String(totalItems);
    badge.setAttribute('aria-label', `${totalItems} artículos en el carrito`);
  }
};

/**
 * Muestra una notificación breve en la esquina de la pantalla.
 * @param {string} message Mensaje.
 * @param {'success'|'danger'|'warning'|'info'} [variant='success'] Color de Bootstrap.
 * @returns {void}
 */
export const showToast = (message, variant = 'success') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = el('div', { className: 'toast-container position-fixed bottom-0 end-0 p-3', attrs: { id: 'toast-container' } });
    document.body.append(container);
  }
  const symbol = variant === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
  const toast = el('div', {
    className: `toast align-items-center text-bg-${variant} border-0`,
    attrs: { role: variant === 'danger' ? 'alert' : 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }
  },
  el('div', { className: 'd-flex' },
    el('div', { className: 'toast-body' }, icon(`${symbol} me-2`), document.createTextNode(message)),
    el('button', { className: 'btn-close btn-close-white me-2 m-auto', attrs: { type: 'button', 'data-bs-dismiss': 'toast', 'aria-label': 'Cerrar' } })
  ));
  container.append(toast);
  toast.addEventListener('hidden.bs.toast', () => toast.remove(), { once: true });
  globalThis.bootstrap.Toast.getOrCreateInstance(toast, { delay: 3500 }).show();
};

/**
 * Crea un aviso de Bootstrap con un botón opcional.
 * @param {'danger'|'warning'|'info'|'secondary'} variant Color.
 * @param {string} message Mensaje.
 * @param {{label: string, action: string}} [button] Botón con data-action para delegación de eventos.
 * @returns {HTMLElement}
 */
export const alertBox = (variant, message, button) => el('div', {
  className: `alert alert-${variant} d-flex flex-wrap align-items-center gap-2 mb-0`,
  attrs: { role: variant === 'danger' ? 'alert' : 'status' }
},
icon(variant === 'danger' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-circle-info'),
el('span', { className: 'flex-grow-1', text: message }),
button && el('button', { className: `btn btn-sm btn-outline-${variant === 'info' ? 'primary' : variant}`, text: button.label, attrs: { type: 'button' }, dataset: { action: button.action } }));

/**
 * Crea el indicador de carga.
 * @param {string} message Texto que acompaña al indicador.
 * @returns {HTMLElement}
 */
export const loadingBox = (message) => el('div', { className: 'd-flex align-items-center justify-content-center gap-2 py-5 text-secondary', attrs: { role: 'status' } },
  el('span', { className: 'spinner-border text-primary', attrs: { 'aria-hidden': 'true' } }),
  el('span', { text: message }));

/**
 * Pide confirmación con el modal #modalConfirmar de Bootstrap en lugar de window.confirm.
 * @param {{title: string, message: string, confirmLabel?: string}} options Textos del modal.
 * @returns {Promise<boolean>} true si el usuario confirmó.
 */
export const confirmDialog = ({ title, message, confirmLabel = 'Eliminar' }) => new Promise((resolve) => {
  const modalElement = document.getElementById('modalConfirmar');
  modalElement.querySelector('[data-confirm-title]').textContent = title;
  modalElement.querySelector('[data-confirm-message]').textContent = message;
  const accept = modalElement.querySelector('[data-confirm-accept]');
  accept.textContent = confirmLabel;

  const modal = globalThis.bootstrap.Modal.getOrCreateInstance(modalElement);
  let confirmed = false;

  const onAccept = () => {
    confirmed = true;
    modal.hide();
  };
  accept.addEventListener('click', onAccept, { once: true });
  modalElement.addEventListener('hidden.bs.modal', () => {
    accept.removeEventListener('click', onAccept);
    resolve(confirmed);
  }, { once: true });
  modal.show();
});
