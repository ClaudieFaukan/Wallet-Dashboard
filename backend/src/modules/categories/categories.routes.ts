import { Router } from 'express';
import { db } from '../../config/database.js';
import { requireAuth } from '../../shared/middleware/auth.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { CategoriesController } from './categories.controller.js';
import { createCategorySchema } from './categories.schema.js';
import { CategoriesService } from './categories.service.js';

const categoriesService = new CategoriesService(db);
const categoriesController = new CategoriesController(categoriesService);

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);
categoriesRouter.get('/', categoriesController.list);
categoriesRouter.post('/', validate(createCategorySchema), categoriesController.create);
