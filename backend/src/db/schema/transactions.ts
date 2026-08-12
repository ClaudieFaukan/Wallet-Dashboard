import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';
import { accounts } from './accounts.js';

export const categoryTypeEnum = pgEnum('category_type', ['income', 'expense']);

export const categories = pgTable('categories', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: categoryTypeEnum('type').notNull(),
  color: text('color'),
  icon: text('icon'),
  isDefault: boolean('is_default').notNull().default(false),
  ...timestamps,
});

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer']);
export const transactionSourceEnum = pgEnum('transaction_source', [
  'manual',
  'revolut_api',
  'csv_import',
  'pdf_import',
]);

export const transactions = pgTable(
  'transactions',
  {
    id: id(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('EUR'),
    type: transactionTypeEnum('type').notNull(),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    description: text('description'),
    date: timestamp('date', { withTimezone: true }).notNull(),
    source: transactionSourceEnum('source').notNull().default('manual'),
    externalId: text('external_id'),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('transactions_account_external_id_idx')
      .on(table.accountId, table.externalId)
      .where(sql`${table.externalId} is not null`),
  ],
);
