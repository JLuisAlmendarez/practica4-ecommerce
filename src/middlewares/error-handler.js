import { ServiceError, ErrorType } from '../services/service-error.js';

/** @type {Record<string, number>} Código HTTP para cada tipo de error de negocio. */
const STATUS_BY_TYPE = {
  [ErrorType.VALIDATION]: 400,
  [ErrorType.NOT_FOUND]: 404,
  [ErrorType.CONFLICT]: 409
};

/**
 * Middleware global de errores: convierte cualquier error en una respuesta JSON.
 * Ninguna solicitud queda sin respuesta; los errores inesperados responden 500 sin exponer detalles internos.
 * @param {Error & {type?: string, details?: Object, status?: number}} err Error recibido.
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 * @param {import('express').NextFunction} next Siguiente middleware.
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ServiceError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(STATUS_BY_TYPE[err.type] ?? 400).json(body);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido' });
  }

  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
};

export default errorHandler;
