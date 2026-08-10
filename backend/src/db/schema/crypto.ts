import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const cryptoPlatformEnum = pgEnum('crypto_platform', [
  'metamask',
  'phantom',
  'crypto_com',
  'binance',
  'bybit',
  'coinbase',
  'kraken',
]);
export const cryptoChainEnum = pgEnum('crypto_chain', ['ethereum', 'solana']);

export const cryptoWallets = pgTable('crypto_wallets', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  platform: cryptoPlatformEnum('platform').notNull(),
  address: text('address').notNull(),
  chain: cryptoChainEnum('chain').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
});

export const cryptoSnapshots = pgTable('crypto_snapshots', {
  id: id(),
  walletId: uuid('wallet_id')
    .notNull()
    .references(() => cryptoWallets.id, { onDelete: 'cascade' }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  totalValueUsd: integer('total_value_usd').notNull(),
  rawData: jsonb('raw_data'),
  ...timestamps,
});
