-- Plan Features: features included in each subscription plan

CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_code TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  limit_value INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, feature_code)
);

ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_features_read_all" ON plan_features FOR SELECT USING (true);

-- Seed default features
INSERT INTO plan_features (plan_id, feature_code, feature_name, is_enabled, limit_value)
SELECT sp.id, f.feature_code, f.feature_name, f.is_enabled, f.limit_value
FROM subscription_plans sp
CROSS JOIN (VALUES
  ('inventory', 'Inventory Management', true, NULL),
  ('pos', 'Point of Sale', true, NULL),
  ('prescriptions', 'Prescriptions & OCR', true, NULL),
  ('lab_management', 'Lab Management', true, NULL),
  ('lpims', 'Lens Power Inventory (LPIMS)', true, NULL),
  ('finance', 'Finance & GST', true, NULL),
  ('multi_branch_reports', 'Multi-Branch Reports', true, NULL),
  ('api_integrations', 'API Integrations', true, NULL),
  ('priority_support', 'Priority Support', true, NULL),
  ('advanced_lab', 'Advanced Lab Features', true, NULL),
  ('advanced_finance', 'Advanced Finance', true, NULL),
  ('max_branches', 'Maximum Branches', true, 1),
  ('max_employees', 'Maximum Employees', true, 5),
  ('max_customers', 'Maximum Customers', true, 1000),
  ('storage_mb', 'Storage (MB)', true, 500)
) AS f(feature_code, feature_name, is_enabled, limit_value)
WHERE sp.slug = 'starter'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

-- Growth plan features
INSERT INTO plan_features (plan_id, feature_code, feature_name, is_enabled, limit_value)
SELECT sp.id, f.feature_code, f.feature_name, f.is_enabled, f.limit_value
FROM subscription_plans sp
CROSS JOIN (VALUES
  ('inventory', 'Inventory Management', true, NULL),
  ('pos', 'Point of Sale', true, NULL),
  ('prescriptions', 'Prescriptions & OCR', true, NULL),
  ('lab_management', 'Lab Management', true, NULL),
  ('lpims', 'Lens Power Inventory (LPIMS)', true, NULL),
  ('finance', 'Finance & GST', true, NULL),
  ('multi_branch_reports', 'Multi-Branch Reports', true, NULL),
  ('api_integrations', 'API Integrations', true, NULL),
  ('priority_support', 'Priority Support', false, NULL),
  ('advanced_lab', 'Advanced Lab Features', true, NULL),
  ('advanced_finance', 'Advanced Finance', true, NULL),
  ('max_branches', 'Maximum Branches', true, 5),
  ('max_employees', 'Maximum Employees', true, 25),
  ('max_customers', 'Maximum Customers', true, 10000),
  ('storage_mb', 'Storage (MB)', true, 5000)
) AS f(feature_code, feature_name, is_enabled, limit_value)
WHERE sp.slug = 'growth'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

-- Enterprise plan features
INSERT INTO plan_features (plan_id, feature_code, feature_name, is_enabled, limit_value)
SELECT sp.id, f.feature_code, f.feature_name, f.is_enabled, f.limit_value
FROM subscription_plans sp
CROSS JOIN (VALUES
  ('inventory', 'Inventory Management', true, NULL),
  ('pos', 'Point of Sale', true, NULL),
  ('prescriptions', 'Prescriptions & OCR', true, NULL),
  ('lab_management', 'Lab Management', true, NULL),
  ('lpims', 'Lens Power Inventory (LPIMS)', true, NULL),
  ('finance', 'Finance & GST', true, NULL),
  ('multi_branch_reports', 'Multi-Branch Reports', true, NULL),
  ('api_integrations', 'API Integrations', true, NULL),
  ('priority_support', 'Priority Support', true, NULL),
  ('advanced_lab', 'Advanced Lab Features', true, NULL),
  ('advanced_finance', 'Advanced Finance', true, NULL),
  ('max_branches', 'Maximum Branches', true, 999),
  ('max_employees', 'Maximum Employees', true, 999),
  ('max_customers', 'Maximum Customers', true, 999999),
  ('storage_mb', 'Storage (MB)', true, 50000)
) AS f(feature_code, feature_name, is_enabled, limit_value)
WHERE sp.slug = 'enterprise'
ON CONFLICT (plan_id, feature_code) DO NOTHING;

CREATE INDEX idx_plan_features_plan ON plan_features(plan_id);
CREATE INDEX idx_plan_features_code ON plan_features(feature_code);