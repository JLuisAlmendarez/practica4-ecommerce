/**
 * Tipos de error de negocio que el middleware error-handler traduce a estados HTTP.
 * @readonly
 * @enum {string}
 */
export const ErrorType = Object.freeze({
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT'
});

/**
 * Error de negocio lanzado por los servicios y middlewares de validación.
 * No depende de Express: el middleware error-handler decide el código HTTP según su tipo.
 * @extends Error
 */
export class ServiceError extends Error {
  /**
   * @param {ErrorType} type Tipo de error.
   * @param {string} message Explicación para el cliente.
   * @param {Object} [details] Información adicional, por ejemplo los campos inválidos.
   */
  constructor(type, message, details) {
    super(message);
    this.name = 'ServiceError';
    this.type = type;
    this.details = details;
  }
}

/**
 * Excepción de productos, heredada de la Práctica 2: datos inválidos o producto inexistente.
 * @extends ServiceError
 */
export class ProductException extends ServiceError {
  /**
   * @param {string} message Descripción del error.
   * @param {ErrorType} [type=ErrorType.VALIDATION] Tipo de error.
   * @param {Object} [details] Información adicional.
   */
  constructor(message, type = ErrorType.VALIDATION, details) {
    super(type, message, details);
    this.name = 'ProductException';
  }
}

/**
 * Excepción del carrito, heredada de la Práctica 2: cantidad inválida, entrada inexistente o falta de existencias.
 * @extends ServiceError
 */
export class ShoppingCartException extends ServiceError {
  /**
   * @param {string} message Descripción del error.
   * @param {ErrorType} [type=ErrorType.VALIDATION] Tipo de error.
   * @param {Object} [details] Información adicional.
   */
  constructor(message, type = ErrorType.VALIDATION, details) {
    super(type, message, details);
    this.name = 'ShoppingCartException';
  }
}
