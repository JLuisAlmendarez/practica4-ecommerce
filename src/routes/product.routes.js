import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import validateProduct from '../middlewares/validate-product.js';

/** @type {import('express').Router} Rutas de /api/products. */
const router = Router();

router.get('/', productController.list);
router.get('/:id', productController.getById);
router.post('/', validateProduct, productController.create);
router.put('/:id', validateProduct, productController.update);
router.delete('/:id', productController.remove);

export default router;
