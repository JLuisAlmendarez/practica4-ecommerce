import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import productRoutes from './routes/product.routes.js';
import cartRoutes from './routes/cart.routes.js';
import notFound from './middlewares/not-found.js';
import errorHandler from './middlewares/error-handler.js';

/** @type {URL} Carpeta con las páginas, estilos, scripts e imágenes del Front-End. */
const PUBLIC_DIR = new URL('../public/', import.meta.url);

/** @type {URL} Carpeta de dependencias de npm de donde se sirven Bootstrap y Font Awesome. */
const MODULES_DIR = new URL('../node_modules/', import.meta.url);

/** @type {string|undefined} Origen permitido por CORS en producción; sin la variable se permite cualquier origen (desarrollo). */
const CORS_ORIGIN = process.env.CORS_ORIGIN?.trim() || undefined;

/** @type {import('express').Express} Aplicación Express de la tienda: API REST y Front-End en el mismo origen. */
const app = express();

app.use(cors(CORS_ORIGIN ? { origin: CORS_ORIGIN } : undefined));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);

app.use('/vendor/bootstrap', express.static(fileURLToPath(new URL('bootstrap/dist/', MODULES_DIR))));
app.use('/vendor/fontawesome', express.static(fileURLToPath(new URL('@fortawesome/fontawesome-free/', MODULES_DIR))));
app.use(express.static(fileURLToPath(PUBLIC_DIR)));

app.use(notFound);
app.use(errorHandler);

export default app;
