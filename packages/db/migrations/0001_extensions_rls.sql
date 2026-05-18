-- ============================================================
-- Row-Level Security: tenant isolation
-- Policy: tenant_id = current_setting('app.tenant_id', true)::uuid
-- Superadmin bypass uses SET LOCAL app.tenant_id = '' (empty → no filter)
-- ============================================================

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON categories
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_variants
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON carts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON appointments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON reservations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- quotes
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON quotes
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- channel_sessions
ALTER TABLE channel_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON channel_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- conversation_state
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversation_state
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- tenant_config
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_config
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ai_knowledge_entries
ALTER TABLE ai_knowledge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_knowledge_entries
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ai_unanswered_queries
ALTER TABLE ai_unanswered_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_unanswered_queries
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON departments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- kanban_columns
ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kanban_columns
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- contact_lists
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contact_lists
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaigns
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON integrations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- deliveries
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON deliveries
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- analytics_daily
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON analytics_daily
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- messages: isolated through conversation's tenant_id via FK, but apply directly
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- cart_items: isolated via cart FK
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cart_items
  USING (
    cart_id IN (
      SELECT id FROM carts
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- order_items: isolated via order FK
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- department_members: isolated via department FK
ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON department_members
  USING (
    department_id IN (
      SELECT id FROM departments
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- contact_list_entries: isolated via contact_list FK
ALTER TABLE contact_list_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contact_list_entries
  USING (
    list_id IN (
      SELECT id FROM contact_lists
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );

-- campaign_logs: isolated via campaign FK
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaign_logs
  USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
    )
  );
