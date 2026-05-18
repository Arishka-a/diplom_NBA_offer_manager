-- Миграция: заполнение тестовыми данными для отчётов
-- Дата: 2026-01-18

-- ============================================================================
-- Дополнительные офферы
-- ============================================================================
INSERT INTO offers (title, description, offer_type, status, priority, start_date, end_date, created_by) VALUES
('Скидка 15% на интернет', 'Скидка на тарифы интернета для новых клиентов', 'discount', 'active', 80, NOW() - INTERVAL '45 days', NOW() + INTERVAL '30 days', 1),
('Бонус 500 рублей', 'Бонус за подключение дополнительных услуг', 'bonus', 'active', 65, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days', 1),
('Рекомендация ТВ-пакета', 'Персональная рекомендация премиум ТВ', 'recommendation', 'active', 70, NOW() - INTERVAL '20 days', NOW() + INTERVAL '40 days', 1),
('Апгрейд до 500 Мбит/с', 'Переход на высокоскоростной тариф', 'upgrade', 'active', 85, NOW() - INTERVAL '15 days', NOW() + INTERVAL '45 days', 1),
('Удержание: скидка 25%', 'Специальная скидка для клиентов с риском оттока', 'retention', 'active', 95, NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 1),
('Скидка 10% на ТВ', 'Скидка на телевизионные пакеты', 'discount', 'active', 60, NOW() - INTERVAL '25 days', NOW() + INTERVAL '35 days', 1),
('Бонус за отзыв', 'Бонус 200 рублей за оставленный отзыв', 'bonus', 'inactive', 40, NOW() - INTERVAL '60 days', NOW() - INTERVAL '5 days', 1),
('Рекомендация роутера', 'Предложение нового Wi-Fi роутера', 'recommendation', 'draft', 55, NOW() + INTERVAL '5 days', NOW() + INTERVAL '60 days', 1),
('Апгрейд до Премиум ТВ', 'Переход на расширенный ТВ-пакет', 'upgrade', 'active', 75, NOW() - INTERVAL '8 days', NOW() + INTERVAL '52 days', 1),
('Удержание: бесплатный роутер', 'Роутер в подарок при продлении договора', 'retention', 'active', 90, NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Связи офферов с сегментами
-- ============================================================================
INSERT INTO offer_segments (offer_id, segment_id)
SELECT o.id, s.id FROM offers o, segments s
WHERE o.title = 'Скидка 15% на интернет' AND s.name = 'Новые клиенты'
ON CONFLICT DO NOTHING;

INSERT INTO offer_segments (offer_id, segment_id)
SELECT o.id, s.id FROM offers o, segments s
WHERE o.title = 'Бонус 500 рублей' AND s.name = 'VIP клиенты'
ON CONFLICT DO NOTHING;

INSERT INTO offer_segments (offer_id, segment_id)
SELECT o.id, s.id FROM offers o, segments s
WHERE o.title = 'Удержание: скидка 25%' AND s.name = 'Риск оттока'
ON CONFLICT DO NOTHING;

INSERT INTO offer_segments (offer_id, segment_id)
SELECT o.id, s.id FROM offers o, segments s
WHERE o.title = 'Апгрейд до 500 Мбит/с' AND s.name = 'Потенциал апгрейда'
ON CONFLICT DO NOTHING;

INSERT INTO offer_segments (offer_id, segment_id)
SELECT o.id, s.id FROM offers o, segments s
WHERE o.title = 'Рекомендация ТВ-пакета' AND s.name = 'Интернет без ТВ'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Взаимодействия клиентов с офферами (customer_offer_interactions)
-- ============================================================================
-- Генерируем данные за последние 30 дней
DO $$
DECLARE
    offer_rec RECORD;
    customer_rec RECORD;
    action_type VARCHAR(20);
    rand_val FLOAT;
    interaction_date TIMESTAMP;
    i INT;
BEGIN
    -- Для каждого активного оффера
    FOR offer_rec IN SELECT id FROM offers WHERE status = 'active' LOOP
        -- Для каждого клиента
        FOR customer_rec IN SELECT id FROM customers LIMIT 50 LOOP
            -- Случайное количество взаимодействий (0-3)
            FOR i IN 1..floor(random() * 4)::int LOOP
                rand_val := random();
                interaction_date := NOW() - (random() * 30)::int * INTERVAL '1 day' - (random() * 24)::int * INTERVAL '1 hour';

                -- 100% просмотров
                INSERT INTO customer_offer_interactions (customer_id, offer_id, action, created_at)
                VALUES (customer_rec.id, offer_rec.id, 'view', interaction_date)
                ON CONFLICT DO NOTHING;

                -- 40% принятий
                IF rand_val < 0.4 THEN
                    INSERT INTO customer_offer_interactions (customer_id, offer_id, action, created_at)
                    VALUES (customer_rec.id, offer_rec.id, 'accept', interaction_date + INTERVAL '1 hour')
                    ON CONFLICT DO NOTHING;
                -- 20% отклонений
                ELSIF rand_val < 0.6 THEN
                    INSERT INTO customer_offer_interactions (customer_id, offer_id, action, created_at)
                    VALUES (customer_rec.id, offer_rec.id, 'reject', interaction_date + INTERVAL '30 minutes')
                    ON CONFLICT DO NOTHING;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- Дополнительные правила NBA
-- ============================================================================
INSERT INTO rules (name, description, rule_type, is_active, priority, weight, rule_definition, target_segments, target_offer_types, created_by) VALUES
('Правило высокого ARPU', 'Приоритет офферов для клиентов с высоким ARPU', 'scoring', true, 90, 1.5,
 '{"condition": "customer.arpu > 1500", "score_modifier": 1.5}',
 ARRAY[2], ARRAY['bonus', 'upgrade'], 1),
('Правило нового клиента', 'Специальные предложения для новых клиентов', 'eligibility', true, 85, 1.3,
 '{"condition": "customer.tenure_months < 3", "eligible": true}',
 ARRAY[1], ARRAY['discount', 'bonus'], 1),
('Правило риска оттока', 'Удержание клиентов с высоким риском оттока', 'scoring', true, 95, 2.0,
 '{"condition": "customer.churn_score > 70", "score_modifier": 2.0}',
 ARRAY[3], ARRAY['retention'], 1),
('Правило апгрейда', 'Предложения апгрейда для подходящих клиентов', 'eligibility', true, 80, 1.2,
 '{"condition": "customer.upgrade_propensity > 0.6", "eligible": true}',
 ARRAY[4], ARRAY['upgrade'], 1),
('Правило кросс-продаж', 'Рекомендации дополнительных услуг', 'scoring', true, 70, 1.1,
 '{"condition": "customer.has_single_product", "score_modifier": 1.1}',
 ARRAY[5], ARRAY['recommendation'], 1),
('Правило сезонности', 'Увеличение приоритета в праздничный период', 'scoring', false, 60, 1.4,
 '{"condition": "date.is_holiday_season", "score_modifier": 1.4}',
 NULL, ARRAY['discount', 'bonus'], 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Логи операций (для отчёта по активности пользователей)
-- ============================================================================
DO $$
DECLARE
    action_types TEXT[] := ARRAY['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT', 'IMPORT'];
    entity_types TEXT[] := ARRAY['Offer', 'Segment', 'Rule', 'User', 'Customer'];
    action_type TEXT;
    entity_type TEXT;
    log_date TIMESTAMP;
    i INT;
BEGIN
    FOR i IN 1..100 LOOP
        action_type := action_types[1 + floor(random() * array_length(action_types, 1))::int];
        entity_type := entity_types[1 + floor(random() * array_length(entity_types, 1))::int];
        log_date := NOW() - (random() * 30)::int * INTERVAL '1 day' - (random() * 24)::int * INTERVAL '1 hour';

        INSERT INTO logs (user_id, action, entity_type, entity_id, details, created_at)
        VALUES (
            1,
            action_type,
            entity_type,
            1 + floor(random() * 10)::int,
            jsonb_build_object('auto_generated', true, 'iteration', i),
            log_date
        );
    END LOOP;
END $$;

-- ============================================================================
-- История изменений (для демонстрации)
-- ============================================================================
INSERT INTO history (entity_type, entity_id, previous_state, changed_by, change_reason, created_at) VALUES
('Offer', 1, '{"title": "Старое название", "priority": 70, "status": "draft"}', 1, 'Изменение приоритета', NOW() - INTERVAL '7 days'),
('Offer', 1, '{"title": "Скидка 20% на первые 3 месяца", "priority": 80, "status": "draft"}', 1, 'Активация оффера', NOW() - INTERVAL '5 days'),
('Offer', 2, '{"title": "Бонус 500 рублей за друга", "priority": 60, "status": "draft"}', 1, 'Увеличение бонуса', NOW() - INTERVAL '10 days'),
('Segment', 1, '{"name": "Новые клиенты", "client_count": 10000}', 1, 'Обновление количества клиентов', NOW() - INTERVAL '3 days'),
('Segment', 2, '{"name": "VIP клиенты", "client_count": 5000, "is_active": false}', 1, 'Активация сегмента', NOW() - INTERVAL '8 days')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Обновление счётчиков клиентов в сегментах
-- ============================================================================
UPDATE segments SET client_count = (
    SELECT COUNT(*) FROM customers WHERE segment_id = segments.id
);

SELECT 'Тестовые данные для отчётов успешно добавлены!' AS status;
