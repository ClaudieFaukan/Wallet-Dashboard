import { date, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const collectibleItemTypeEnum = pgEnum('collectible_item_type', ['card', 'sealed']);
export const collectiblePriceSourceEnum = pgEnum('collectible_price_source', [
  'tcgdex',
  'manual',
  'pokemonpricetracker',
  'poketrace',
]);
export const collectibleConditionEnum = pgEnum('collectible_condition', [
  'NM',
  'LP',
  'MP',
  'HP',
  'DMG',
]);
export const collectibleSealedTypeEnum = pgEnum('collectible_sealed_type', [
  'booster_box',
  'etb',
  'blister',
  'collection',
  'display',
]);
export const collectibleSealedLanguageEnum = pgEnum('collectible_sealed_language', [
  'FR',
  'EN',
  'JP',
]);
// FEAT-11 (docs/feat1.md): only 'pokemon' has a real search/price integration (TCGdex is
// Pokémon-only, verified against tcgdex.dev — the doc's claim that it also covers these other
// games doesn't hold) — the rest are stored for organization, manual price entry only.
export const collectibleTcgTypeEnum = pgEnum('collectible_tcg_type', [
  'pokemon',
  'onepiece',
  'dragonball',
  'digimon',
  'lorcana',
  'starwars',
]);

export type CollectiblePriceSource = (typeof collectiblePriceSourceEnum.enumValues)[number];
export type CollectiblePriceSnapshotSource =
  (typeof collectiblePriceSnapshotSourceEnum.enumValues)[number];

export const collectibleItems = pgTable('collectible_items', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  itemType: collectibleItemTypeEnum('item_type').notNull(),
  name: text('name').notNull(),
  setName: text('set_name'),
  imageUrl: text('image_url'),
  notes: text('notes'),
  purchasePrice: integer('purchase_price').notNull(),
  purchaseDate: date('purchase_date').notNull(),
  priceSource: collectiblePriceSourceEnum('price_source').notNull().default('manual'),

  // Card-only fields (item_type = 'card')
  cardNumber: text('card_number'),
  condition: collectibleConditionEnum('condition'),
  tcgdexId: text('tcgdex_id'),
  tcgType: collectibleTcgTypeEnum('tcg_type').notNull().default('pokemon'),

  // Sealed-only fields (item_type = 'sealed')
  sealedType: collectibleSealedTypeEnum('sealed_type'),
  sealedLanguage: collectibleSealedLanguageEnum('sealed_language'),

  ...timestamps,
});

export const collectiblePriceSnapshotSourceEnum = pgEnum('collectible_price_snapshot_source', [
  'tcgdex_cardmarket',
  'tcgdex_tcgplayer',
  'pokemonpricetracker',
  'poketrace',
  'manual',
]);

export const collectiblePriceSnapshots = pgTable('collectible_price_snapshots', {
  id: id(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => collectibleItems.id, { onDelete: 'cascade' }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  marketPriceEur: integer('market_price_eur'),
  marketPriceUsd: integer('market_price_usd'),
  source: collectiblePriceSnapshotSourceEnum('source').notNull(),
  rawData: jsonb('raw_data'),
  ...timestamps,
});
