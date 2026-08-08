import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://pierre-alain@localhost:5432/wallet_dashboard_test',
      JWT_SECRET: 'test-only-secret-do-not-use-in-production-0123456789abcdef0123456789abcdef',
      JWT_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
      CORS_ORIGIN: 'http://localhost:5173',
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
