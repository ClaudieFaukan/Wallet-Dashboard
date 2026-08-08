import { date, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const collectibleTypeEnum = pgEnum('collectible_type', ['pokemon_card']);

export const collectibleItems = pgTable('collectible_items', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: collectibleTypeEnum('type').notNull().default('pokemon_card'),
  name: text('name').notNull(),
  setName: text('set_name'),
  cardNumber: text('card_number'),
  condition: text('condition'),
  purchasePrice: integer('purchase_price').notNull(),
  purchaseDate: date('purchase_date').notNull(),
  tcgProductId: text('tcg_product_id'),
  imageUrl: text('image_url'),
  notes: text('notes'),
  ...timestamps,
});

export const collectiblePriceSnapshots = pgTable('collectible_price_snapshots', {
  id: id(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => collectibleItems.id, { onDelete: 'cascade' }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  marketPrice: integer('market_price').notNull(),
  source: text('source'),
  ...timestamps,
});
