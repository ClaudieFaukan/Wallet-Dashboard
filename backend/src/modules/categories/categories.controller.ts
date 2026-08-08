import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from '../../shared/middleware/auth.middleware.js';
import type { CategoriesService } from './categories.service.js';
import type { CreateCategoryInput } from './categories.schema.js';

export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  list: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const categories = await this.categoriesService.list(user.id);
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  };

  create: RequestHandler = async (req, res, next) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const category = await this.categoriesService.create(
        user.id,
        req.body as CreateCategoryInput,
      );
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  };
}
