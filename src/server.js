import app from './app.js';

/** @type {number} Puerto del servidor; se puede cambiar con la variable de entorno PORT. */
const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Anime Store (Front-End y API) en http://localhost:${PORT}`);
});
