import crypto from 'node:crypto';
import { env } from '../../config/env.js';

// Revolut Business (Open Banking) API. Endpoint hosts below follow Revolut's
// documented sandbox/production split — verify against the real Revolut
// Developer docs once REVOLUT_CLIENT_ID is actually configured, this has
// never been exercised against a live Revolut app.
const API_BASE = {
  sandbox: 'https://sandbox-b2b.revolut.com/api/1.0',
  production: 'https://b2b.revolut.com/api/1.0',
} as const;

const AUTH_BASE = {
  sandbox: 'https://sandbox-business.revolut.com',
  production: 'https://business.revolut.com',
} as const;

export interface RevolutTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface RevolutAccount {
  id: string;
  name: string;
  balance: number;
  currency: string;
}

export interface RevolutTransaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  state: string;
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

export class RevolutClient {
  private readonly apiBase = API_BASE[env.REVOLUT_ENVIRONMENT];
  private readonly authBase = AUTH_BASE[env.REVOLUT_ENVIRONMENT];

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  getAuthorizationUrl(redirectUri: string, state: string, codeChallenge: string): string {
    const url = new URL('/app-confirm', this.authBase);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<RevolutTokens> {
    return this.requestTokens({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<RevolutTokens> {
    return this.requestTokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  async getAccounts(accessToken: string): Promise<RevolutAccount[]> {
    return this.get<RevolutAccount[]>('/accounts', accessToken);
  }

  async getTransactions(
    accessToken: string,
    params: { from?: string; to?: string; count?: number; cursor?: string } = {},
  ): Promise<RevolutTransaction[]> {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.count) query.set('count', String(params.count));
    if (params.cursor) query.set('cursor', params.cursor);

    return this.get<RevolutTransaction[]>(`/transactions?${query.toString()}`, accessToken);
  }

  private async requestTokens(body: Record<string, string>): Promise<RevolutTokens> {
    const response = await fetch(`${this.authBase}/api/1.0/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...body,
      }),
    });

    if (!response.ok) {
      throw new Error(`Revolut token request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
    };
  }

  private async get<T>(path: string, accessToken: string): Promise<T> {
    const response = await fetch(`${this.apiBase}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Revolut API request failed: ${response.status} ${await response.text()}`);
    }

    return (await response.json()) as T;
  }
}
