/**
 * Responde 404 en JSON para cualquier ruta que no coincidió con las rutas registradas.
 * @param {import('express').Request} req Solicitud.
 * @param {import('express').Response} res Respuesta.
 */
const notFound = (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    method: req.method,
    path: req.originalUrl
  });
};

export default notFound;
