-- Billing and auth tables
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES saas_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'COP',
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id, status);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_expires ON password_reset_tokens(user_id, expires_at);

CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period VARCHAR(7) NOT NULL,
  conversations INTEGER DEFAULT 0,
  ai_messages INTEGER DEFAULT 0,
  campaigns INTEGER DEFAULT 0,
  team_members INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_counters_tenant_period_idx ON usage_counters(tenant_id, period);

-- Add missing foreign keys that couldn't be added via Drizzle schema alone
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tenants_plan_id_saas_plans_fkey') THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_plan_id_saas_plans_fkey
      FOREIGN KEY (plan_id) REFERENCES saas_plans(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tenants_reseller_id_saas_resellers_fkey') THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_reseller_id_saas_resellers_fkey
      FOREIGN KEY (reseller_id) REFERENCES saas_resellers(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_department_id_fkey') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES departments(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversations_kanban_column_id_fkey') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_kanban_column_id_fkey
      FOREIGN KEY (kanban_column_id) REFERENCES kanban_columns(id);
  END IF;
END $$;

-- Fix messages RLS to use direct tenant_id instead of subquery
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'tenant_isolation'
             AND qual LIKE '%SELECT id FROM conversations%') THEN
    DROP POLICY tenant_isolation ON messages;
    CREATE POLICY tenant_isolation ON messages
      AS PERMISSIVE FOR ALL TO app
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;
