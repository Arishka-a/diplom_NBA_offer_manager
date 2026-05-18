-- Миграция: создание таблицы customer_offer_interactions для отслеживания взаимодействий
-- Дата: 2026-01-18

-- Таблица взаимодействий клиентов с офферами
CREATE TABLE IF NOT EXISTS customer_offer_interactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    offer_id INTEGER REFERENCES offers(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'accept', 'reject', 'dismiss')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_coi_customer_id ON customer_offer_interactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_coi_offer_id ON customer_offer_interactions(offer_id);
CREATE INDEX IF NOT EXISTS idx_coi_action ON customer_offer_interactions(action);
CREATE INDEX IF NOT EXISTS idx_coi_created_at ON customer_offer_interactions(created_at);

-- Комментарий к таблице
COMMENT ON TABLE customer_offer_interactions IS 'История взаимодействий клиентов с офферами (просмотры, принятия, отклонения)';
