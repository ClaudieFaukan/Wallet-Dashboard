import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  currency: text('currency').notNull().default('EUR'),
  // FEAT-09 (docs/feat1.md): the seeded demo account (see db/seeds/demo-data.ts) — fully
  // editable except /settings (requireAuth), reseeded fresh on every login.
  isDemo: boolean('is_demo').notNull().default(false),
  ...timestamps,
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  rememberMe: boolean('remember_me').notNull().default(false),
  ...timestamps,
});
