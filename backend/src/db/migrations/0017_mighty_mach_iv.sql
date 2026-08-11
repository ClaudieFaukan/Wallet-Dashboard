ALTER TYPE "public"."crypto_platform" ADD VALUE 'meria';--> statement-breakpoint
CREATE TABLE "crypto_cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"amount_invested_cents" integer NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crypto_cost_entries" ADD CONSTRAINT "crypto_cost_entries_wallet_id_crypto_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."crypto_wallets"("id") ON DELETE cascade ON UPDATE no action;