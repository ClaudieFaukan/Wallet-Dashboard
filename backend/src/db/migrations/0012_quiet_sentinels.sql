ALTER TYPE "public"."collectible_item_type" ADD VALUE 'watch';--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "watch_condition" text;