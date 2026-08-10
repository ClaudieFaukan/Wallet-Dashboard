CREATE TYPE "public"."real_estate_type" AS ENUM('physical', 'scpi', 'crowdfunding');--> statement-breakpoint
CREATE TABLE "real_estate_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" real_estate_type NOT NULL,
	"platform" text,
	"purchase_price" integer NOT NULL,
	"current_value" integer NOT NULL,
	"purchase_date" date NOT NULL,
	"monthly_income" integer DEFAULT 0 NOT NULL,
	"surface_m2" real,
	"location" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "real_estate_value_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"value" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "real_estate_assets" ADD CONSTRAINT "real_estate_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_value_history" ADD CONSTRAINT "real_estate_value_history_asset_id_real_estate_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."real_estate_assets"("id") ON DELETE cascade ON UPDATE no action;