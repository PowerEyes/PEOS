-- Tenant Isolation Test: Cross-tenant read prevention
-- Run with: psql -f supabase/tests/tenant_isolation/01_cross_tenant_read.sql

-- Setup: Create two test tenants
DO $$
BEGIN
  -- Tenant A
  INSERT INTO tenants (id, name, slug) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Tenant A', 'tenant-a')
  ON CONFLICT (id) DO NOTHING;

  -- Tenant B
  INSERT INTO tenants (id, name, slug) VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'Tenant B', 'tenant-b')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Insert a customer for Tenant B
INSERT INTO customers (tenant_id, name, phone) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Secret Customer B', '9999999999')
ON CONFLICT DO NOTHING;

-- Test 1: Tenant A user should NOT see Tenant B's customers
SET ROLE authenticated;
-- Simulate Tenant A JWT claims
SELECT set_config('request.jwt.claims', '{"sub":"user-a","tenant_id":"aaaaaaaa-0000-0000-0000-000000000001"}', true);

-- This should return 0 rows
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT count(*) INTO cnt FROM customers WHERE tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  IF cnt > 0 THEN
    RAISE EXCEPTION 'FAIL: Tenant A can see Tenant B customers (count: %)', cnt;
  ELSE
    RAISE NOTICE 'PASS: Tenant A cannot see Tenant B customers';
  END IF;
END $$;

-- Cleanup
RESET ROLE;
DELETE FROM customers WHERE tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002';
DELETE FROM tenants WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');