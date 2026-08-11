import { date, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_helpers.js';
import { users } from './users.js';

export const collectibleItemTypeEnum = pgEnum('collectible_item_type', ['card', 'sealed', 'watch']);
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
// Separate type from collectibleSealedLanguageEnum even though the values are identical —
// cards and sealed products are different item types with independently evolving option
// lists (e.g. cards are far more likely to gain DE/IT/ES prints than sealed product).
export const collectibleCardLanguageEnum = pgEnum('collectible_card_language', ['FR', 'EN', 'JP']);
// PSA/BGS/CGC/SGC cover the vast majority of graded Pokémon cards in circulation;
// 'other' is the catch-all for less common graders (details go in `notes`).
export const collectibleGradingCompanyEnum = pgEnum('collectible_grading_company', [
  'PSA',
  'BGS',
  'CGC',
  'SGC',
  'other',
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
  language: collectibleCardLanguageEnum('language'),
  // Null gradingCompany means the card is raw/ungraded (`condition` applies instead).
  gradingCompany: collectibleGradingCompanyEnum('grading_company'),
  // e.g. 9.5 for a PSA 9.5 — numeric (not float) so 9.5 stays exact, matching this
  // codebase's no-float rule for anything stored with a fixed decimal meaning.
  gradingScore: numeric('grading_score', { precision: 3, scale: 1, mode: 'number' }),

  // Sealed-only fields (item_type = 'sealed')
  sealedType: collectibleSealedTypeEnum('sealed_type'),
  sealedLanguage: collectibleSealedLanguageEnum('sealed_language'),

  // Watch-only fields (item_type = 'watch') — FEAT-13 (docs/feat1.md): no reliable public
  // pricing API exists (Chrono24 has none), so watches are always priceSource='manual'.
  brand: text('brand'),
  model: text('model'),
  reference: text('reference'),
  year: integer('year'),
  watchCondition: text('watch_condition'),

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
