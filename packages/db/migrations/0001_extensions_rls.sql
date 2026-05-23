-- ============================================================
-- Row-Level Security: tenant isolation
-- Policy: tenant_id = current_setting('app.tenant_id', true)::uuid
-- Superadmin bypass uses SET LOCAL app.tenant_id = '' (empty → no filter)
-- ============================================================

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'users' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON users
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'customers' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON customers
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'categories' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON categories
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'products' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON products
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON product_variants
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'carts' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON carts
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'orders' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON orders
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON appointments
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'reservations' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON reservations
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON quotes
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- channel_sessions
ALTER TABLE channel_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'channel_sessions' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON channel_sessions
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON conversations
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- conversation_state
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'conversation_state' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON conversation_state
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- tenant_config
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'tenant_config' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON tenant_config
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- ai_knowledge_entries
ALTER TABLE ai_knowledge_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'ai_knowledge_entries' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON ai_knowledge_entries
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- ai_unanswered_queries
ALTER TABLE ai_unanswered_queries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'ai_unanswered_queries' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON ai_unanswered_queries
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'departments' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON departments
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- kanban_columns
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'kanban_columns' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON kanban_columns
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- contact_lists
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'contact_lists' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON contact_lists
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON campaigns
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON integrations
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- deliveries
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'deliveries' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON deliveries
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'payments' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON payments
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- analytics_daily
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'analytics_daily' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON analytics_daily
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
  END IF;
END $$;

-- messages: isolated through conversation's tenant_id via FK, but apply directly
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'messages' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON messages
      USING (
        conversation_id IN (
          SELECT id FROM conversations
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      );
  END IF;
END $$;

-- cart_items: isolated via cart FK
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'cart_items' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON cart_items
      USING (
        cart_id IN (
          SELECT id FROM carts
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      );
  END IF;
END $$;

-- order_items: isolated via order FK
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON order_items
      USING (
        order_id IN (
          SELECT id FROM orders
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      );
  END IF;
END $$;

-- department_members: isolated via department FK
ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'department_members' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON department_members
      USING (
        department_id IN (
          SELECT id FROM departments
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      );
  END IF;
END $$;

-- contact_list_entries: isolated via contact_list FK
ALTER TABLE contact_list_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'contact_list_entries' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON contact_list_entries
      USING (
        list_id IN (
          SELECT id FROM contact_lists
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      );
  END IF;
END $$;

-- campaign_logs: isolated via campaign FK
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'campaign_logs' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON campaign_logs
      USING (
        campaign_id IN (
          SELECT id FROM campaigns
          WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      );
  END IF;
END $$;
