import { beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../src/config/database.js';

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users, refresh_tokens RESTART IDENTITY CASCADE`);
});
