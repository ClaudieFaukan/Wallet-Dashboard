import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const appSettings = pgTable(
  'app_settings',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    valueEncrypted: text('value_encrypted').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('app_settings_user_key_idx').on(table.userId, table.key)],
);
