CREATE TABLE "stock_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"price" real NOT NULL,
	"change_percent" real NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_quotes_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
ALTER TABLE "investment_entries" ADD COLUMN "ticker" text;