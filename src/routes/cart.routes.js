import { Router } from 'express';
import * as cartController from '../controllers/cart.controller.js';
import validateCartUser from '../middlewares/validate-cart-user.js';

/** @type {import('express').Router} Rutas de /api/cart; todas requieren el header x-user. */
const router = Router();

router.use(validateCartUser);

router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.patch('/items/:productId', cartController.updateItem);
router.delete('/items/:productId', cartController.removeItem);

export default router;
