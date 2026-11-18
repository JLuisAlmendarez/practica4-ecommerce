import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {string} Carpeta de persistencia; DATA_DIR permite usar una copia aislada en las pruebas automáticas. */
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : fileURLToPath(new URL('../../data/', import.meta.url));

/**
 * Regresa la ruta absoluta de un archivo JSON dentro de la carpeta de persistencia.
 * @param {string} name Nombre del archivo, por ejemplo products.json.
 * @returns {string}
 */
export const dataFile = (name) => resolve(DATA_DIR, name);
