import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dataFile } from '../src/repositories/data-dir.js';

/** @type {string[]} Archivos de persistencia que se restauran desde data/seed. */
const FILES = ['products.json', 'carts.json'];

for (const name of FILES) {
  const seed = fileURLToPath(new URL(`../data/seed/${name}`, import.meta.url));
  await copyFile(seed, dataFile(name));
  console.log(`Restaurado ${name}`);
}
