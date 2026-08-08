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
      ENCRYPTION_KEY: '156a389103a9d4053bacdebc6f9dd41933c9a820a5209ffd5c52b55191eefbf0',
      // Fake — fetch is always mocked in tests that exercise the Etherscan sync path.
      ETHERSCAN_API_KEY: 'test-etherscan-key',
    },
    setupFiles: ['./tests/setup.ts'],
    // All test files share one real Postgres DB truncated between tests —
    // running files in parallel races the truncation against other files.
    fileParallelism: false,
  },
});
