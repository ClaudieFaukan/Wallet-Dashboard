import type { Request, RequestHandler, Response } from 'express';
import { env } from '../../config/env.js';
import type { AuthService } from './auth.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const REFRESH_COOKIE_NAME = 'refresh_token';

function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/api/v1/auth',
  });
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register: RequestHandler = async (req: Request<unknown, unknown, RegisterInput>, res, next) => {
    try {
      const tokens = await this.authService.register(req.body);
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      res.status(201).json({ success: true, data: { accessToken: tokens.accessToken } });
    } catch (err) {
      next(err);
    }
  };

  login: RequestHandler = async (req: Request<unknown, unknown, LoginInput>, res, next) => {
    try {
      const tokens = await this.authService.login(req.body);
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      res.json({ success: true, data: { accessToken: tokens.accessToken } });
    } catch (err) {
      next(err);
    }
  };

  refresh: RequestHandler = async (req, res, next) => {
    try {
      const rawToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
      const tokens = await this.authService.refresh(rawToken);
      setRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);
      res.json({ success: true, data: { accessToken: tokens.accessToken } });
    } catch (err) {
      next(err);
    }
  };

  logout: RequestHandler = async (req, res, next) => {
    try {
      const rawToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
      await this.authService.logout(rawToken);
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
