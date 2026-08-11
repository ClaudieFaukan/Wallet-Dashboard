/**
 * Manual/CI entry point for demo seeding — the actual logic lives in demo-data.ts and
 * also runs automatically on every login with the demo credentials (see
 * AuthService.login). Run with: npm run db:seed:demo
 */
import { db } from '../../config/database.js';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoAccount } from './demo-data.js';

seedDemoAccount(db)
  .then(() => {
    console.log(`Demo account ready: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Demo seed failed:', err);
    process.exit(1);
  });
