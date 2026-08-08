import { Router } from 'express';
import { db } from '../../config/database.js';
import { authRateLimiter } from '../../shared/middleware/rateLimiter.middleware.js';
import { validate } from '../../shared/middleware/validate.middleware.js';
import { AuthController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { AuthService } from './auth.service.js';

const authService = new AuthService(db);
const authController = new AuthController(authService);

export const authRouter = Router();

authRouter.use(authRateLimiter);
authRouter.post('/register', validate(registerSchema), authController.register);
authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
