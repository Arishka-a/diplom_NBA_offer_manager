-- Migration: Add customers table
-- Created: 2026-01-03
-- Description: This table stores customer information for NBA analysis

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),

    -- Financial metrics
    arpu DECIMAL(10,2) DEFAULT 0.00,

    -- Behavioral metrics
    tenure_months INTEGER DEFAULT 0,
    churn_score DECIMAL(3,2) DEFAULT 0.00
        CHECK (churn_score >= 0 AND churn_score <= 1.00),

    -- Segmentation
    segment_id INTEGER REFERENCES segments(id) ON DELETE SET NULL,

    -- Additional attributes
    status VARCHAR(20) DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'suspended', 'churned')),

    -- Metadata
    registered_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_segment_id ON customers(segment_id);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_arpu ON customers(arpu DESC);
CREATE INDEX idx_customers_churn_score ON customers(churn_score DESC);
CREATE INDEX idx_customers_tenure ON customers(tenure_months DESC);
CREATE INDEX idx_customers_last_activity ON customers(last_activity_at DESC);

-- Add trigger to auto-update updated_at timestamp
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for customer analytics
CREATE OR REPLACE VIEW v_customer_analytics AS
SELECT
    c.id,
    c.first_name || ' ' || c.last_name AS full_name,
    c.email,
    c.phone,
    c.arpu,
    c.tenure_months,
    c.churn_score,
    c.status,
    s.name AS segment_name,
    s.id AS segment_id,
    c.registered_at,
    c.last_activity_at,
    -- Categorize customers by value
    CASE
        WHEN c.arpu >= 2000 THEN 'High Value'
        WHEN c.arpu >= 1000 THEN 'Medium Value'
        ELSE 'Low Value'
    END AS value_category,
    -- Categorize by churn risk
    CASE
        WHEN c.churn_score >= 0.7 THEN 'High Risk'
        WHEN c.churn_score >= 0.4 THEN 'Medium Risk'
        ELSE 'Low Risk'
    END AS churn_risk_category,
    -- Count of offers shown
    (SELECT COUNT(*) FROM offer_history oh WHERE oh.customer_id = c.id) AS total_offers_shown,
    -- Count of accepted offers
    (SELECT COUNT(*) FROM offer_history oh WHERE oh.customer_id = c.id AND oh.status = 'accepted') AS total_offers_accepted
FROM customers c
LEFT JOIN segments s ON c.segment_id = s.id
ORDER BY c.id;

-- Create view for customer segments distribution
CREATE OR REPLACE VIEW v_customer_segment_distribution AS
SELECT
    s.id AS segment_id,
    s.name AS segment_name,
    COUNT(c.id) AS customer_count,
    ROUND(AVG(c.arpu), 2) AS avg_arpu,
    ROUND(AVG(c.churn_score), 2) AS avg_churn_score,
    ROUND(AVG(c.tenure_months), 2) AS avg_tenure_months
FROM segments s
LEFT JOIN customers c ON s.id = c.segment_id
GROUP BY s.id, s.name
ORDER BY customer_count DESC;

-- Insert sample customers data
INSERT INTO customers (first_name, last_name, email, phone, arpu, tenure_months, churn_score, segment_id, status, registered_at, last_activity_at) VALUES
-- VIP customers (segment 2: VIP клиенты)
('Иван', 'Иванов', 'ivan.ivanov@example.com', '+79001234567', 2500.00, 36, 0.15, 2, 'active', NOW() - INTERVAL '36 months', NOW() - INTERVAL '1 day'),
('Мария', 'Петрова', 'maria.petrova@example.com', '+79001234568', 1800.00, 28, 0.20, 2, 'active', NOW() - INTERVAL '28 months', NOW() - INTERVAL '2 days'),
('Алексей', 'Сидоров', 'alexey.sidorov@example.com', '+79001234569', 2200.00, 42, 0.10, 2, 'active', NOW() - INTERVAL '42 months', NOW() - INTERVAL '1 day'),

-- New customers (segment 1: Новые клиенты)
('Ольга', 'Новикова', 'olga.novikova@example.com', '+79001234570', 800.00, 2, 0.35, 1, 'active', NOW() - INTERVAL '2 months', NOW() - INTERVAL '3 days'),
('Дмитрий', 'Козлов', 'dmitry.kozlov@example.com', '+79001234571', 650.00, 1, 0.40, 1, 'active', NOW() - INTERVAL '1 month', NOW() - INTERVAL '5 days'),
('Елена', 'Морозова', 'elena.morozova@example.com', '+79001234572', 900.00, 3, 0.30, 1, 'active', NOW() - INTERVAL '3 months', NOW() - INTERVAL '2 days'),

-- Churn risk customers (segment 3: Риск оттока)
('Сергей', 'Волков', 'sergey.volkov@example.com', '+79001234573', 1200.00, 24, 0.85, 3, 'active', NOW() - INTERVAL '24 months', NOW() - INTERVAL '30 days'),
('Татьяна', 'Лебедева', 'tatyana.lebedeva@example.com', '+79001234574', 950.00, 18, 0.75, 3, 'active', NOW() - INTERVAL '18 months', NOW() - INTERVAL '45 days'),
('Андрей', 'Соколов', 'andrey.sokolov@example.com', '+79001234575', 1100.00, 15, 0.80, 3, 'active', NOW() - INTERVAL '15 months', NOW() - INTERVAL '60 days'),

-- Upgrade potential (segment 4: Потенциал апгрейда)
('Наталья', 'Павлова', 'natalya.pavlova@example.com', '+79001234576', 900.00, 12, 0.25, 4, 'active', NOW() - INTERVAL '12 months', NOW() - INTERVAL '1 day'),
('Владимир', 'Федоров', 'vladimir.fedorov@example.com', '+79001234577', 1050.00, 16, 0.20, 4, 'active', NOW() - INTERVAL '16 months', NOW() - INTERVAL '2 days'),

-- Internet-only users (segment 5: Только интернет)
('Екатерина', 'Смирнова', 'ekaterina.smirnova@example.com', '+79001234578', 700.00, 8, 0.45, 5, 'active', NOW() - INTERVAL '8 months', NOW() - INTERVAL '3 days'),
('Михаил', 'Кузнецов', 'mikhail.kuznetsov@example.com', '+79001234579', 650.00, 10, 0.50, 5, 'active', NOW() - INTERVAL '10 months', NOW() - INTERVAL '4 days'),

-- Loyal customers (segment 6: Лояльные клиенты)
('Анна', 'Васильева', 'anna.vasilyeva@example.com', '+79001234580', 1400.00, 48, 0.05, 6, 'active', NOW() - INTERVAL '48 months', NOW() - INTERVAL '1 day'),
('Павел', 'Николаев', 'pavel.nikolaev@example.com', '+79001234581', 1600.00, 60, 0.08, 6, 'active', NOW() - INTERVAL '60 months', NOW() - INTERVAL '2 days'),
('Ирина', 'Григорьева', 'irina.grigoryeva@example.com', '+79001234582', 1350.00, 52, 0.06, 6, 'active', NOW() - INTERVAL '52 months', NOW() - INTERVAL '1 day'),

-- Additional customers without segments
('Виктор', 'Романов', 'viktor.romanov@example.com', '+79001234583', 800.00, 6, 0.55, NULL, 'active', NOW() - INTERVAL '6 months', NOW() - INTERVAL '7 days'),
('Людмила', 'Захарова', 'lyudmila.zakharova@example.com', '+79001234584', 500.00, 3, 0.60, NULL, 'active', NOW() - INTERVAL '3 months', NOW() - INTERVAL '10 days'),
('Георгий', 'Степанов', 'georgy.stepanov@example.com', '+79001234585', 1000.00, 20, 0.30, NULL, 'active', NOW() - INTERVAL '20 months', NOW() - INTERVAL '5 days'),
('Светлана', 'Орлова', 'svetlana.orlova@example.com', '+79001234586', 750.00, 14, 0.40, NULL, 'active', NOW() - INTERVAL '14 months', NOW() - INTERVAL '8 days'),

-- Inactive/churned customers
('Максим', 'Белов', 'maxim.belov@example.com', '+79001234587', 600.00, 5, 0.95, 3, 'churned', NOW() - INTERVAL '5 months', NOW() - INTERVAL '90 days');

-- Update offer_history to link with real customer IDs
UPDATE offer_history SET customer_id = 1 WHERE customer_id = 1001;
UPDATE offer_history SET customer_id = 2 WHERE customer_id = 1002;
UPDATE offer_history SET customer_id = 3 WHERE customer_id = 1003;
UPDATE offer_history SET customer_id = 4 WHERE customer_id = 1004;
UPDATE offer_history SET customer_id = 5 WHERE customer_id = 1005;
UPDATE offer_history SET customer_id = 6 WHERE customer_id = 1006;
UPDATE offer_history SET customer_id = 7 WHERE customer_id = 1007;
UPDATE offer_history SET customer_id = 8 WHERE customer_id = 1008;

-- Add foreign key constraint to offer_history
ALTER TABLE offer_history
ADD CONSTRAINT offer_history_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Comments
COMMENT ON TABLE customers IS 'Customer information and analytics data';
COMMENT ON COLUMN customers.arpu IS 'Average Revenue Per User (monthly in RUB)';
COMMENT ON COLUMN customers.tenure_months IS 'Number of months as active customer';
COMMENT ON COLUMN customers.churn_score IS 'Predicted probability of customer churn (0.00 to 1.00)';
COMMENT ON COLUMN customers.segment_id IS 'Current customer segment classification';
COMMENT ON COLUMN customers.metadata IS 'Additional customer data in JSON format';

-- Update role permissions to include customers access
UPDATE roles
SET permissions = jsonb_set(permissions, '{customers}', '["read", "create", "update", "delete"]'::jsonb)
WHERE name = 'Administrator';

UPDATE roles
SET permissions = jsonb_set(permissions, '{customers}', '["read", "create"]'::jsonb)
WHERE name = 'Operator';
