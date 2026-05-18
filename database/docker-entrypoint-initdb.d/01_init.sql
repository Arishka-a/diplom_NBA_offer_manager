-- ============================================================================
-- NBA-OfferManager: Инициализация базы данных
-- Этот файл автоматически выполняется при первом запуске контейнера
-- ============================================================================

-- ============================================================================
-- ЧАСТЬ 1: СХЕМА БАЗЫ ДАННЫХ
-- ============================================================================

-- Удаление существующих таблиц (в правильном порядке из-за FK)
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS conditions CASCADE;
DROP TABLE IF EXISTS offer_segments CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS segments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ============================================================================
-- Таблица: roles (Роли пользователей)
-- ============================================================================
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'Роли пользователей системы';

-- ============================================================================
-- Таблица: users (Пользователи)
-- ============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    CONSTRAINT chk_username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);

-- ============================================================================
-- Таблица: segments (Сегменты клиентов)
-- ============================================================================
CREATE TABLE segments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    criteria JSONB NULL,
    client_count INTEGER NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_segment_name_length CHECK (LENGTH(name) >= 3),
    CONSTRAINT chk_client_count_positive CHECK (client_count >= 0)
);

CREATE INDEX idx_segments_name ON segments(name);
CREATE INDEX idx_segments_is_active ON segments(is_active);

-- ============================================================================
-- Таблица: offers (Офферы)
-- ============================================================================
CREATE TABLE offers (
    id SERIAL PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NULL,
    offer_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    priority INTEGER NOT NULL DEFAULT 50,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_title_length CHECK (LENGTH(title) >= 3),
    CONSTRAINT chk_offer_type CHECK (offer_type IN ('discount', 'bonus', 'recommendation', 'upgrade', 'retention')),
    CONSTRAINT chk_status CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
    CONSTRAINT chk_priority_range CHECK (priority >= 1 AND priority <= 100),
    CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date > start_date)
);

CREATE INDEX idx_offers_status ON offers(status);
CREATE INDEX idx_offers_offer_type ON offers(offer_type);
CREATE INDEX idx_offers_priority ON offers(priority DESC);
CREATE INDEX idx_offers_start_date ON offers(start_date);
CREATE INDEX idx_offers_created_by ON offers(created_by);
CREATE INDEX idx_offers_created_at ON offers(created_at DESC);

-- ============================================================================
-- Таблица: offer_segments (Связь офферов и сегментов, M:N)
-- ============================================================================
CREATE TABLE offer_segments (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_offer_segment UNIQUE (offer_id, segment_id)
);

CREATE INDEX idx_offer_segments_offer_id ON offer_segments(offer_id);
CREATE INDEX idx_offer_segments_segment_id ON offer_segments(segment_id);

-- ============================================================================
-- Таблица: conditions (Условия активации офферов)
-- ============================================================================
CREATE TABLE conditions (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL,
    condition_value JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_condition_type CHECK (condition_type IN ('time', 'trigger', 'limit', 'channel', 'frequency'))
);

CREATE INDEX idx_conditions_offer_id ON conditions(offer_id);
CREATE INDEX idx_conditions_type ON conditions(condition_type);

-- ============================================================================
-- Таблица: logs (Логирование операций)
-- ============================================================================
CREATE TABLE logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    details JSONB NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'IMPORT', 'EXPORT'))
);

CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_action ON logs(action);
CREATE INDEX idx_logs_entity_type ON logs(entity_type);
CREATE INDEX idx_logs_entity_id ON logs(entity_id);
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);

-- ============================================================================
-- Таблица: history (История изменений объектов)
-- ============================================================================
CREATE TABLE history (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    previous_state JSONB NOT NULL,
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_reason TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_history_entity_lookup ON history(entity_type, entity_id);
CREATE INDEX idx_history_created_at ON history(created_at DESC);

-- ============================================================================
-- Триггер: Автообновление updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_segments_updated_at
    BEFORE UPDATE ON segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Представления (Views)
-- ============================================================================

CREATE OR REPLACE VIEW v_active_offers AS
SELECT 
    o.id,
    o.title,
    o.description,
    o.offer_type,
    o.status,
    o.priority,
    o.start_date,
    o.end_date,
    o.created_at,
    u.username AS created_by_username,
    COALESCE(
        json_agg(
            json_build_object('id', s.id, 'name', s.name)
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
    ) AS segments
FROM offers o
LEFT JOIN users u ON o.created_by = u.id
LEFT JOIN offer_segments os ON o.id = os.offer_id
LEFT JOIN segments s ON os.segment_id = s.id
WHERE o.status = 'active'
  AND o.start_date <= CURRENT_TIMESTAMP
  AND (o.end_date IS NULL OR o.end_date > CURRENT_TIMESTAMP)
GROUP BY o.id, u.username
ORDER BY o.priority DESC;

CREATE OR REPLACE VIEW v_offer_statistics AS
SELECT 
    o.status,
    o.offer_type,
    COUNT(*) AS total_count,
    AVG(o.priority) AS avg_priority
FROM offers o
GROUP BY o.status, o.offer_type;

-- ============================================================================
-- Функции
-- ============================================================================

CREATE OR REPLACE FUNCTION get_offers_for_segment(p_segment_id INTEGER, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    offer_id INTEGER,
    title VARCHAR(100),
    offer_type VARCHAR(50),
    priority INTEGER,
    start_date TIMESTAMP,
    end_date TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.title,
        o.offer_type,
        o.priority,
        o.start_date,
        o.end_date
    FROM offers o
    JOIN offer_segments os ON o.id = os.offer_id
    WHERE os.segment_id = p_segment_id
      AND o.status = 'active'
      AND o.start_date <= CURRENT_TIMESTAMP
      AND (o.end_date IS NULL OR o.end_date > CURRENT_TIMESTAMP)
    ORDER BY o.priority DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ЧАСТЬ 2: НАЧАЛЬНЫЕ ДАННЫЕ (SEEDS)
-- ============================================================================

-- Роли
INSERT INTO roles (name, permissions) VALUES
(
    'Operator',
    '{
        "offers": ["read", "create", "update", "delete"],
        "segments": ["read", "create", "update"],
        "conditions": ["read", "create", "update", "delete"],
        "logs": ["read"],
        "reports": ["read", "export"],
        "import": ["execute"]
    }'::jsonb
),
(
    'Administrator',
    '{
        "offers": ["read", "create", "update", "delete"],
        "segments": ["read", "create", "update", "delete"],
        "conditions": ["read", "create", "update", "delete"],
        "users": ["read", "create", "update", "delete"],
        "roles": ["read", "update"],
        "logs": ["read", "delete"],
        "reports": ["read", "export"],
        "import": ["execute"],
        "system": ["configure"]
    }'::jsonb
);

-- Администратор (пароль: Admin123! - bcrypt hash)
-- ВАЖНО: ОБЯЗАТЕЛЬНО замените пароль перед продакшн-деплоем!
-- Для генерации нового хэша используйте:
--   cd server && node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourNewPassword', 10, (err, hash) => { console.log(hash); });"
INSERT INTO users (username, email, password_hash, role_id, is_active) VALUES
(
    'admin',
    'admin@nba-offermanager.local',
    '$2b$10$7.PCpCTKPoBHOkMh/DazT.sACiJd68DKPQ1ES68fi46QuKF9xJxqO',
    2,
    TRUE
);

-- Тестовые сегменты
INSERT INTO segments (name, description, criteria, client_count) VALUES
('Новые клиенты', 'Клиенты, подключившиеся менее 3 месяцев назад', 
 '{"registration_date": {"operator": ">=", "value": "-3 months"}}'::jsonb, 15420),
('VIP клиенты', 'Клиенты с высоким ARPU (более 1500 руб/мес)', 
 '{"arpu": {"operator": ">=", "value": 1500}}'::jsonb, 8750),
('Риск оттока', 'Клиенты с высокой вероятностью оттока', 
 '{"churn_score": {"operator": ">=", "value": 0.7}}'::jsonb, 3200),
('Потенциал апгрейда', 'Клиенты с потенциалом перехода на дорогой тариф', 
 '{"upgrade_propensity": {"operator": ">=", "value": 0.6}}'::jsonb, 12300),
('Интернет без ТВ', 'Клиенты с интернетом, но без ТВ', 
 '{"has_internet": true, "has_tv": false}'::jsonb, 45600),
('Давние клиенты', 'Клиенты со стажем более 2 лет', 
 '{"tenure_months": {"operator": ">=", "value": 24}}'::jsonb, 67800);

-- Тестовые офферы
INSERT INTO offers (title, description, offer_type, status, priority, start_date, end_date, created_by) VALUES
('Скидка 20% на первые 3 месяца', 'Специальное предложение для новых клиентов', 
 'discount', 'active', 85, CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP + INTERVAL '60 days', 1),
('Бонус 1000 рублей за друга', 'Приведите друга и получите бонус', 
 'bonus', 'active', 70, CURRENT_TIMESTAMP - INTERVAL '15 days', CURRENT_TIMESTAMP + INTERVAL '90 days', 1),
('Апгрейд до Premium', 'Переход на тариф Premium со скидкой 30%', 
 'upgrade', 'active', 90, CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP + INTERVAL '30 days', 1),
('Удержание: бесплатный месяц', 'Бесплатный месяц при продлении договора', 
 'retention', 'active', 95, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '14 days', 1),
('ТВ-пакет в подарок', 'Подключите ТВ бесплатно на 6 месяцев', 
 'recommendation', 'active', 75, CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP + INTERVAL '45 days', 1);

-- Связи офферов с сегментами
INSERT INTO offer_segments (offer_id, segment_id) VALUES
(1, 1), (2, 1), (2, 6), (3, 4), (3, 2), (4, 3), (5, 5);

-- Условия офферов
INSERT INTO conditions (offer_id, condition_type, condition_value) VALUES
(1, 'time', '{"days_of_week": [1,2,3,4,5], "hours": {"start": 9, "end": 21}}'::jsonb),
(1, 'channel', '{"allowed": ["web", "mobile_app", "call_center"]}'::jsonb),
(1, 'frequency', '{"max_per_client": 1, "period_days": 30}'::jsonb),
(4, 'trigger', '{"event": "churn_prediction_high", "threshold": 0.7}'::jsonb),
(4, 'limit', '{"total_budget": 500000, "max_clients": 1000}'::jsonb);

-- ============================================================================
-- Готово! База данных инициализирована
-- ============================================================================
SELECT 'NBA-OfferManager database initialized successfully!' AS status;
