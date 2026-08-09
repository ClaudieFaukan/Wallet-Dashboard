import type { Request, RequestHandler, Response } from 'express';
import { env } from '../../config/env.js';
import type { AuthService, AuthTokens } from './auth.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const REFRESH_COOKIE_NAME = 'refresh_token';

/** When `rememberMe` is false, the cookie is issued with no `expires` at
 * all — a browser session cookie, cleared when the browser closes — instead
 * of the 7d/30d persistent cookie. This achieves FEAT-03's "not remembered =
 * expires at session close" without ever exposing the refresh token to JS
 * (it stays httpOnly; sessionStorage was the spec's literal suggestion but
 * would have meant reading/writing it from the frontend, which defeats the
 * httpOnly protection this project deliberately chose at auth setup time). */
function setRefreshCookie(res: Response, tokens: AuthTokens): void {
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    ...(tokens.rememberMe ? { expires: tokens.refreshTokenExpiresAt } : {}),
    path: '/api/v1/auth',
  });
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register: RequestHandler = async (req: Request<unknown, unknown, RegisterInput>, res, next) => {
    try {
      const tokens = await this.authService.register(req.body);
      setRefreshCookie(res, tokens);
      res.status(201).json({ success: true, data: { accessToken: tokens.accessToken } });
    } catch (err) {
      next(err);
    }
  };

  login: RequestHandler = async (req: Request<unknown, unknown, LoginInput>, res, next) => {
    try {
      const tokens = await this.authService.login(req.body);
      setRefreshCookie(res, tokens);
      res.json({ success: true, data: { accessToken: tokens.accessToken } });
    } catch (err) {
      next(err);
    }
  };

  refresh: RequestHandler = async (req, res, next) => {
    try {
      const rawToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
      const tokens = await this.authService.refresh(rawToken);
      setRefreshCookie(res, tokens);
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
