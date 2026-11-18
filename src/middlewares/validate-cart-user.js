import { ShoppingCartException } from '../services/service-error.js';

/** @type {RegExp} Formato permitido para el usuario de prueba. */
const USER_PATTERN = /^[a-z0-9._-]{1,40}$/;

/**
 * Valida y normaliza el header x-user y lo guarda en req.user.
 * No es autenticación: sólo identifica el carrito de un usuario de prueba.
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 * @param {import('express').NextFunction} next Siguiente middleware.
 */
const validateCartUser = (req, res, next) => {
  const raw = req.get('x-user');
  const user = raw?.trim().toLowerCase() ?? '';

  if (!user) {
    return next(new ShoppingCartException('El header x-user es obligatorio para usar el carrito'));
  }
  if (!USER_PATTERN.test(user)) {
    return next(new ShoppingCartException(
      'x-user sólo admite letras, números, punto, guion y guion bajo (máximo 40 caracteres)',
      undefined,
      { user: raw }
    ));
  }

  req.user = user;
  next();
};

export default validateCartUser;
