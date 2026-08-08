import { boolean, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const accountTypeEnum = pgEnum('account_type', ['checking', 'savings', 'investment']);

export const accounts = pgTable('accounts', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  institution: text('institution'),
  balance: integer('balance').notNull().default(0),
  currency: text('currency').notNull().default('EUR'),
  color: text('color'),
  icon: text('icon'),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});
