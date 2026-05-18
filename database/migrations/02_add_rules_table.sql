-- ============================================================================
-- МИГРАЦИЯ: Добавление таблицы правил NBA (Next Best Action)
-- Дата: 30.12.2025
-- Описание: Таблица для хранения бизнес-правил приоритизации офферов
-- ============================================================================

-- ============================================================================
-- Таблица: rules (Правила NBA)
-- ============================================================================
-- Хранит бизнес-правила для определения "следующего лучшего действия"
-- Правила используются алгоритмом для расчета score каждого оффера
-- ============================================================================

CREATE TABLE IF NOT EXISTS rules (
    id SERIAL PRIMARY KEY,

    -- Основная информация
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    rule_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Приоритет правила (1-100, чем выше - тем важнее)
    priority INTEGER NOT NULL DEFAULT 50,

    -- Определение правила
    rule_definition JSONB NOT NULL,

    -- Вес правила для расчета score (0.0 - 1.0)
    weight DECIMAL(3,2) NOT NULL DEFAULT 0.50,

    -- Условия применения правила
    apply_conditions JSONB NULL,

    -- Целевые сегменты (NULL = применяется ко всем)
    target_segments INTEGER[] NULL,

    -- Целевые типы офферов (NULL = применяется ко всем)
    target_offer_types VARCHAR(50)[] NULL,

    -- Метаданные
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ограничения
    CONSTRAINT chk_rule_name_length CHECK (LENGTH(name) >= 3),
    CONSTRAINT chk_rule_type CHECK (rule_type IN (
        'priority_boost',      -- Повышение приоритета
        'scoring',             -- Правило расчета score
        'filtering',           -- Фильтрация офферов
        'segmentation',        -- Сегментация клиентов
        'timing',              -- Временные правила
        'budget',              -- Бюджетные ограничения
        'frequency',           -- Частота показа
        'conversion'           -- Правила на основе конверсии
    )),
    CONSTRAINT chk_priority_range CHECK (priority >= 1 AND priority <= 100),
    CONSTRAINT chk_weight_range CHECK (weight >= 0.0 AND weight <= 1.0)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_rules_rule_type ON rules(rule_type);
CREATE INDEX idx_rules_is_active ON rules(is_active);
CREATE INDEX idx_rules_priority ON rules(priority DESC);
CREATE INDEX idx_rules_created_at ON rules(created_at DESC);
CREATE INDEX idx_rules_target_segments ON rules USING GIN (target_segments);
CREATE INDEX idx_rules_target_offer_types ON rules USING GIN (target_offer_types);

-- Комментарии
COMMENT ON TABLE rules IS 'Бизнес-правила для алгоритма Next Best Action';
COMMENT ON COLUMN rules.rule_type IS 'Тип правила: priority_boost, scoring, filtering, segmentation, timing, budget, frequency, conversion';
COMMENT ON COLUMN rules.priority IS 'Приоритет правила (1-100), чем выше - тем важнее';
COMMENT ON COLUMN rules.weight IS 'Вес правила для расчета итогового score (0.0 - 1.0)';
COMMENT ON COLUMN rules.rule_definition IS 'JSON объект с определением правила';
COMMENT ON COLUMN rules.apply_conditions IS 'JSON объект с условиями применения правила';
COMMENT ON COLUMN rules.target_segments IS 'Массив ID сегментов, к которым применяется правило (NULL = все)';
COMMENT ON COLUMN rules.target_offer_types IS 'Массив типов офферов, к которым применяется правило (NULL = все)';

-- ============================================================================
-- Таблица: rule_executions (История выполнения правил)
-- ============================================================================
-- Логирование применения правил для аналитики и отладки
-- ============================================================================

CREATE TABLE IF NOT EXISTS rule_executions (
    id BIGSERIAL PRIMARY KEY,

    rule_id INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,

    -- Контекст выполнения
    client_segment_id INTEGER REFERENCES segments(id) ON DELETE SET NULL,
    execution_context JSONB NULL,

    -- Результаты применения правила
    score_before DECIMAL(5,2) NULL,
    score_after DECIMAL(5,2) NULL,
    score_delta DECIMAL(5,2) NULL,

    -- Применилось ли правило
    was_applied BOOLEAN NOT NULL DEFAULT FALSE,
    skip_reason VARCHAR(255) NULL,

    -- Метаданные
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX idx_rule_executions_rule_id ON rule_executions(rule_id);
CREATE INDEX idx_rule_executions_offer_id ON rule_executions(offer_id);
CREATE INDEX idx_rule_executions_executed_at ON rule_executions(executed_at DESC);
CREATE INDEX idx_rule_executions_was_applied ON rule_executions(was_applied);

COMMENT ON TABLE rule_executions IS 'История выполнения правил NBA для аналитики';

-- ============================================================================
-- Триггер: Автообновление updated_at для rules
-- ============================================================================

CREATE TRIGGER trigger_rules_updated_at
    BEFORE UPDATE ON rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Функция: Получение активных правил для оффера
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_rules_for_offer(
    p_offer_id INTEGER,
    p_segment_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    rule_id INTEGER,
    rule_name VARCHAR(100),
    rule_type VARCHAR(50),
    priority INTEGER,
    weight DECIMAL(3,2),
    rule_definition JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.name,
        r.rule_type,
        r.priority,
        r.weight,
        r.rule_definition
    FROM rules r
    JOIN offers o ON o.id = p_offer_id
    WHERE r.is_active = TRUE
      -- Проверка типа оффера
      AND (r.target_offer_types IS NULL OR o.offer_type = ANY(r.target_offer_types))
      -- Проверка сегмента (если передан)
      AND (p_segment_id IS NULL OR r.target_segments IS NULL OR p_segment_id = ANY(r.target_segments))
    ORDER BY r.priority DESC, r.weight DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_rules_for_offer IS 'Получает все активные правила, применимые к офферу';

-- ============================================================================
-- Функция: Расчет базового score для оффера
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_base_score(
    p_offer_id INTEGER
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_score DECIMAL(5,2);
    v_priority INTEGER;
    v_is_active BOOLEAN;
BEGIN
    -- Получаем приоритет и статус оффера
    SELECT priority, (status = 'active') INTO v_priority, v_is_active
    FROM offers
    WHERE id = p_offer_id;

    -- Базовый score = приоритет (если оффер активен)
    IF v_is_active THEN
        v_score := v_priority::DECIMAL;
    ELSE
        v_score := 0.0;
    END IF;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_base_score IS 'Рассчитывает базовый score оффера на основе приоритета';

-- ============================================================================
-- Представление: Статистика применения правил
-- ============================================================================

CREATE OR REPLACE VIEW v_rule_statistics AS
SELECT
    r.id AS rule_id,
    r.name AS rule_name,
    r.rule_type,
    r.is_active,
    COUNT(re.id) AS total_executions,
    COUNT(re.id) FILTER (WHERE re.was_applied = TRUE) AS successful_applications,
    ROUND(
        COUNT(re.id) FILTER (WHERE re.was_applied = TRUE)::DECIMAL /
        NULLIF(COUNT(re.id), 0) * 100,
        2
    ) AS application_rate_percent,
    AVG(re.score_delta) FILTER (WHERE re.was_applied = TRUE) AS avg_score_impact,
    MAX(re.executed_at) AS last_execution
FROM rules r
LEFT JOIN rule_executions re ON r.id = re.rule_id
GROUP BY r.id, r.name, r.rule_type, r.is_active;

COMMENT ON VIEW v_rule_statistics IS 'Статистика эффективности правил NBA';

-- ============================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ: Примеры правил NBA
-- ============================================================================

-- Правило 1: Повышение приоритета для VIP-сегмента
INSERT INTO rules (
    name,
    description,
    rule_type,
    is_active,
    priority,
    weight,
    rule_definition,
    apply_conditions,
    target_segments,
    created_by
) VALUES (
    'Приоритет для VIP клиентов',
    'Повышение score на 20% для офферов, направленных на VIP-сегмент',
    'priority_boost',
    TRUE,
    90,
    0.80,
    '{
        "boost_type": "percentage",
        "boost_value": 20,
        "description": "Увеличивает score на 20% для VIP"
    }'::jsonb,
    '{
        "min_client_arpu": 1500,
        "segment_names": ["VIP клиенты"]
    }'::jsonb,
    ARRAY[2],  -- ID сегмента "VIP клиенты"
    1
);

-- Правило 2: Scoring на основе риска оттока
INSERT INTO rules (
    name,
    description,
    rule_type,
    is_active,
    priority,
    weight,
    rule_definition,
    apply_conditions,
    target_segments,
    target_offer_types,
    created_by
) VALUES (
    'Приоритет удержания при оттоке',
    'Повышение score для retention офферов, если клиент в зоне риска',
    'scoring',
    TRUE,
    95,
    0.90,
    '{
        "score_calculation": "base_score * (1 + churn_risk * 0.5)",
        "max_boost": 50,
        "description": "Score увеличивается пропорционально риску оттока"
    }'::jsonb,
    '{
        "churn_score": {"operator": ">=", "value": 0.6},
        "client_tenure_months": {"operator": ">=", "value": 6}
    }'::jsonb,
    ARRAY[3],  -- ID сегмента "Риск оттока"
    ARRAY['retention'],
    1
);

-- Правило 3: Фильтрация по частоте показов
INSERT INTO rules (
    name,
    description,
    rule_type,
    is_active,
    priority,
    weight,
    rule_definition,
    apply_conditions,
    created_by
) VALUES (
    'Лимит частоты показов',
    'Исключить офферы, показанные клиенту более 3 раз за последние 30 дней',
    'frequency',
    TRUE,
    85,
    0.70,
    '{
        "max_impressions": 3,
        "period_days": 30,
        "action": "exclude",
        "description": "Не показывать, если уже видел 3 раза за месяц"
    }'::jsonb,
    '{
        "apply_to_all_clients": true
    }'::jsonb,
    1
);

-- Правило 4: Бюджетное ограничение
INSERT INTO rules (
    name,
    description,
    rule_type,
    is_active,
    priority,
    weight,
    rule_definition,
    apply_conditions,
    target_offer_types,
    created_by
) VALUES (
    'Бюджет на бонусы',
    'Снижение приоритета бонусных офферов при превышении 80% бюджета',
    'budget',
    TRUE,
    70,
    0.60,
    '{
        "budget_threshold_percent": 80,
        "score_reduction_percent": 50,
        "description": "При расходе 80% бюджета - снизить score на 50%"
    }'::jsonb,
    '{
        "budget_type": "monthly",
        "check_frequency": "daily"
    }'::jsonb,
    ARRAY['bonus'],
    1
);

-- Правило 5: Временное правило - повышение в пиковое время
INSERT INTO rules (
    name,
    description,
    rule_type,
    is_active,
    priority,
    weight,
    rule_definition,
    apply_conditions,
    created_by
) VALUES (
    'Boost в рабочее время',
    'Повышение приоритета офферов в рабочие часы (10:00-18:00)',
    'timing',
    TRUE,
    60,
    0.50,
    '{
        "time_ranges": [
            {"start_hour": 10, "end_hour": 18}
        ],
        "days_of_week": [1, 2, 3, 4, 5],
        "score_boost": 15,
        "description": "Добавить 15 очков в рабочее время"
    }'::jsonb,
    '{
        "timezone": "Europe/Moscow"
    }'::jsonb,
    1
);

-- Правило 6: Конверсионное правило
INSERT INTO rules (
    name,
    description,
    rule_type,
    is_active,
    priority,
    weight,
    rule_definition,
    apply_conditions,
    created_by
) VALUES (
    'Приоритет высококонверсионным',
    'Повышение score для офферов с конверсией выше 10%',
    'conversion',
    TRUE,
    80,
    0.75,
    '{
        "min_conversion_rate": 0.10,
        "score_multiplier": 1.25,
        "min_impressions": 100,
        "description": "Умножить score на 1.25, если конверсия > 10%"
    }'::jsonb,
    '{
        "require_historical_data": true,
        "min_data_points": 100
    }'::jsonb,
    1
);

-- ============================================================================
-- Обновление прав доступа к правилам
-- ============================================================================

-- Добавляем права на работу с правилами в роли
UPDATE roles
SET permissions = permissions ||
    '{"rules": ["read", "create", "update", "delete"]}'::jsonb
WHERE name = 'Administrator';

UPDATE roles
SET permissions = permissions ||
    '{"rules": ["read"]}'::jsonb
WHERE name = 'Operator';

-- ============================================================================
-- Готово! Таблица правил создана
-- ============================================================================

SELECT 'Rules table and NBA engine foundation created successfully!' AS status;
