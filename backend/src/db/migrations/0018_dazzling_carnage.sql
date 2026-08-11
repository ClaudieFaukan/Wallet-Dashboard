CREATE TYPE "public"."collectible_card_language" AS ENUM('FR', 'EN', 'JP');--> statement-breakpoint
CREATE TYPE "public"."collectible_grading_company" AS ENUM('PSA', 'BGS', 'CGC', 'SGC', 'other');--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "language" "collectible_card_language";--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "grading_company" "collectible_grading_company";--> statement-breakpoint
ALTER TABLE "collectible_items" ADD COLUMN "grading_score" numeric(3, 1);