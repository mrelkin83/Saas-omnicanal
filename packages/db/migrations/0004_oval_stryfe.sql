CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"trial_end" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'COP',
	"billing_cycle" varchar(20) DEFAULT 'monthly',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period" varchar(7) NOT NULL,
	"conversations" integer DEFAULT 0,
	"ai_messages" integer DEFAULT 0,
	"campaigns" integer DEFAULT 0,
	"team_members" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reference" varchar(255);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_saas_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."saas_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_saas_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."saas_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_reseller_id_saas_resellers_id_fk" FOREIGN KEY ("reseller_id") REFERENCES "public"."saas_resellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_kanban_column_id_kanban_columns_id_fk" FOREIGN KEY ("kanban_column_id") REFERENCES "public"."kanban_columns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_products_tenant_active" ON "products" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_products_tenant_category" ON "products" USING btree ("tenant_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_products_tenant_type" ON "products" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_status" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_customer" ON "orders" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_orders_tenant_created" ON "orders" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_appointments_tenant_status" ON "appointments" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_appointments_tenant_scheduled" ON "appointments" USING btree ("tenant_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_appointments_tenant_customer" ON "appointments" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_sessions_tenant_channel_idx" ON "channel_sessions" USING btree ("tenant_id","channel");--> statement-breakpoint
CREATE INDEX "idx_campaigns_tenant_status" ON "campaigns" USING btree ("tenant_id","status");