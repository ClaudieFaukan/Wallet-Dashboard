CREATE TABLE "credit_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"amount" integer NOT NULL,
	"principal_part" integer NOT NULL,
	"interest_part" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"institution" text NOT NULL,
	"initial_amount" integer NOT NULL,
	"remaining_amount" integer NOT NULL,
	"monthly_payment" integer NOT NULL,
	"interest_rate" real NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"early_repayment_fee_rate" real DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_credit_id_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."credits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;