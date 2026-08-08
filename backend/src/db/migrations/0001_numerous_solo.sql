CREATE TYPE "public"."collectible_condition" AS ENUM('NM', 'LP', 'MP', 'HP', 'DMG');--> statement-breakpoint
CREATE TYPE "public"."collectible_item_type" AS ENUM('card', 'sealed');--> statement-breakpoint
CREATE TYPE "public"."collectible_price_snapshot_source" AS ENUM('tcgdex_cardmarket', 'tcgdex_tcgplayer', 'pokemonpricetracker', 'poketrace', 'manual');--> statement-breakpoint
CREATE TYPE "public"."collectible_price_source" AS ENUM('tcgdex', 'manual', 'pokemonpricetracker', 'poketrace');--> statement-breakpoint
CREATE TYPE "public"."collectible_sealed_language" AS ENUM('FR', 'EN', 'JP');--> statement-breakpoint
CREATE TYPE "public"."collectible_sealed_type" AS ENUM('booster_box', 'etb', 'blister', 'collection', 'display');--> statement-breakpoint
ALTER TABLE "collectible_items" ALTER COLUMN "condition" SET DATA TYPE "public"."collectible_condition" USING "condition"::"public"."collectible_condition";--> statement-breakpoint
ALTER TABLE "collectible_price_snapshots" ALTER COLUMN "source" SET DATA TYPE "public"."collectible_price_snapshot_source" USING "source"::"public"."collectible_price_snapshot_source";--> statement-breakpoint
ALTER TABLE "collectible_price_snapshots" ALTER COLUMN "source" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "item_type" "collectible_item_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "price_source" "collectible_price_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "tcgdex_id" text;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "sealed_type" "collectible_sealed_type";--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "sealed_language" "collectible_sealed_language";--> statement-breakpoint
ALTER TABLE "collectible_price_snapshots" ADD COLUMN "market_price_eur" integer;--> statement-breakpoint
ALTER TABLE "collectible_price_snapshots" ADD COLUMN "market_price_usd" integer;--> statement-breakpoint
ALTER TABLE "collectible_price_snapshots" ADD COLUMN "raw_data" jsonb;--> statement-breakpoint
ALTER TABLE "collectible_items" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "collectible_items" DROP COLUMN "tcg_product_id";--> statement-breakpoint
ALTER TABLE "collectible_price_snapshots" DROP COLUMN "market_price";--> statement-breakpoint
DROP TYPE "public"."collectible_type";