-- Migration: Add offer_history table for tracking offer displays
-- Created: 2026-01-03
-- Description: This table tracks when offers are shown to customers and their responses

-- Create offer_history table
CREATE TABLE IF NOT EXISTS offer_history (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    shown_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'shown'
        CHECK (status IN ('shown', 'clicked', 'accepted', 'rejected')),
    channel VARCHAR(50)
        CHECK (channel IN ('email', 'web', 'mobile', 'sms', 'push', 'call_center')),
    response_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_offer_history_customer ON offer_history(customer_id);
CREATE INDEX idx_offer_history_offer ON offer_history(offer_id);
CREATE INDEX idx_offer_history_shown_at ON offer_history(shown_at);
CREATE INDEX idx_offer_history_status ON offer_history(status);
CREATE INDEX idx_offer_history_channel ON offer_history(channel);

-- Add trigger to auto-update updated_at timestamp
CREATE TRIGGER update_offer_history_updated_at
    BEFORE UPDATE ON offer_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for offer conversion statistics
CREATE OR REPLACE VIEW v_offer_conversion_stats AS
SELECT
    o.id AS offer_id,
    o.title AS offer_title,
    o.type AS offer_type,
    COUNT(oh.id) AS total_shown,
    COUNT(CASE WHEN oh.status = 'clicked' THEN 1 END) AS total_clicked,
    COUNT(CASE WHEN oh.status = 'accepted' THEN 1 END) AS total_accepted,
    COUNT(CASE WHEN oh.status = 'rejected' THEN 1 END) AS total_rejected,
    ROUND(
        COUNT(CASE WHEN oh.status = 'clicked' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(oh.id), 0) * 100,
        2
    ) AS click_through_rate,
    ROUND(
        COUNT(CASE WHEN oh.status = 'accepted' THEN 1 END)::NUMERIC /
        NULLIF(COUNT(oh.id), 0) * 100,
        2
    ) AS conversion_rate,
    oh.channel,
    DATE(oh.shown_at) AS date_shown
FROM offers o
LEFT JOIN offer_history oh ON o.id = oh.offer_id
WHERE oh.shown_at IS NOT NULL
GROUP BY o.id, o.title, o.type, oh.channel, DATE(oh.shown_at)
ORDER BY total_shown DESC;

-- Create view for customer offer history
CREATE OR REPLACE VIEW v_customer_offer_history AS
SELECT
    oh.id,
    oh.customer_id,
    oh.offer_id,
    o.title AS offer_title,
    o.type AS offer_type,
    o.description,
    oh.shown_at,
    oh.status,
    oh.channel,
    oh.response_at,
    oh.metadata
FROM offer_history oh
JOIN offers o ON oh.offer_id = o.id
ORDER BY oh.shown_at DESC;

-- Insert sample data for testing
INSERT INTO offer_history (customer_id, offer_id, status, channel, shown_at, response_at) VALUES
(1001, 1, 'accepted', 'email', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 hours'),
(1002, 1, 'clicked', 'web', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '30 minutes'),
(1003, 2, 'accepted', 'mobile', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '1 hour'),
(1004, 2, 'rejected', 'email', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '15 minutes'),
(1005, 3, 'shown', 'web', NOW() - INTERVAL '2 days', NULL),
(1006, 3, 'accepted', 'push', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '3 hours'),
(1007, 4, 'clicked', 'mobile', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '20 minutes'),
(1008, 4, 'shown', 'email', NOW() - INTERVAL '1 day', NULL),
(1001, 5, 'accepted', 'web', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '10 hours'),
(1002, 5, 'rejected', 'mobile', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours');

COMMENT ON TABLE offer_history IS 'Tracks the history of offer displays and customer responses';
COMMENT ON COLUMN offer_history.customer_id IS 'ID of the customer who was shown the offer';
COMMENT ON COLUMN offer_history.offer_id IS 'ID of the offer that was shown';
COMMENT ON COLUMN offer_history.shown_at IS 'Timestamp when the offer was shown to the customer';
COMMENT ON COLUMN offer_history.status IS 'Status of the offer interaction: shown, clicked, accepted, rejected';
COMMENT ON COLUMN offer_history.channel IS 'Communication channel used: email, web, mobile, sms, push, call_center';
COMMENT ON COLUMN offer_history.response_at IS 'Timestamp when the customer responded to the offer';
COMMENT ON COLUMN offer_history.metadata IS 'Additional metadata in JSON format (campaign info, device info, etc.)';
