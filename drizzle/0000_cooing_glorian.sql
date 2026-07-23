CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"bill_month" text NOT NULL,
	"previous_reading" numeric(14, 2) DEFAULT 0 NOT NULL,
	"current_reading" numeric(14, 2) DEFAULT 0 NOT NULL,
	"rate_per_unit" numeric(10, 2) DEFAULT 0 NOT NULL,
	"units_used" numeric(14, 2) DEFAULT 0 NOT NULL,
	"electricity_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"rent_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"other_charges" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"unit_id" integer NOT NULL,
	"move_in_date" text NOT NULL,
	"security_deposit" numeric(12, 2) DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"monthly_rent" numeric(12, 2) NOT NULL,
	"meter_number" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bills_tenant_month_idx" ON "bills" USING btree ("tenant_id","bill_month");