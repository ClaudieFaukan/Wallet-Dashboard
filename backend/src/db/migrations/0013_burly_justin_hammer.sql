CREATE TYPE "public"."investment_asset_type" AS ENUM('stock', 'etf');--> statement-breakpoint
ALTER TABLE "investment_entries" ADD COLUMN "asset_type" "investment_asset_type";--> statement-breakpoint
ALTER TABLE "investment_entries" ADD COLUMN "isin" text;--> statement-breakpoint
ALTER TABLE "investment_entries" ADD COLUMN "shares" numeric(18, 6);