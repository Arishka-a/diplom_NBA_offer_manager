-- Миграция: схема для реальных данных из NBA_offers.xlsx
-- Дата: 2026-04-21
-- Описание: добавляет каталог продуктов, VAS-сервисов, каналы офферов,
--           детали офферов (цены, железо, скидки) и правила availability.
--           Существующая таблица offers сохраняется, добавляются 2 nullable колонки.

-- ============================================================================
-- Таблица: products (Каталог продуктов телеком-оператора)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200),
    category VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

COMMENT ON TABLE products IS 'Каталог продуктов (STO_PLUS, ROUTER, SVOD_PREMIER и т.д.)';
COMMENT ON COLUMN products.code IS 'Технический код продукта из Excel (PRODUCT)';
COMMENT ON COLUMN products.category IS 'Категория: tariff, hardware, svod, service';

-- ============================================================================
-- Таблица: vas (Каталог Value-Added Services)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    calc_name VARCHAR(100),
    vas_type VARCHAR(50),
    service_name TEXT,
    price_base DECIMAL(10,2),
    cost_standalone DECIMAL(10,2),
    cost_package DECIMAL(10,2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vas_calc_name ON vas(calc_name);
CREATE INDEX IF NOT EXISTS idx_vas_type ON vas(vas_type);

COMMENT ON TABLE vas IS 'Value-Added Services (Amediateka, Premier, IVI и т.д.)';

-- ============================================================================
-- ALTER offers: добавляем product_id и economic_id
-- ============================================================================
ALTER TABLE offers ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS economic_id INTEGER UNIQUE;

CREATE INDEX IF NOT EXISTS idx_offers_product_id ON offers(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_economic_id ON offers(economic_id);

COMMENT ON COLUMN offers.product_id IS 'Ссылка на каталог products';
COMMENT ON COLUMN offers.economic_id IS 'Внешний экономический ID из источника (Excel)';

-- ============================================================================
-- Таблица: offer_channels (Каналы коммуникации для каждого оффера)
-- ============================================================================
CREATE TABLE IF NOT EXISTS offer_channels (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    is_actual BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_channel CHECK (channel IN ('phone', 'push', 'mail', 'sms', 'lm', 'okc', 'ltv')),
    CONSTRAINT uq_offer_channel UNIQUE (offer_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_offer_channels_offer_id ON offer_channels(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_channels_channel ON offer_channels(channel);

COMMENT ON TABLE offer_channels IS 'Через какие каналы оффер показывается (phone, push, mail, sms, lm, okc, ltv)';

-- ============================================================================
-- Таблица: offer_details (Детальные параметры оффера)
-- ============================================================================
CREATE TABLE IF NOT EXISTS offer_details (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL UNIQUE REFERENCES offers(id) ON DELETE CASCADE,

    -- Технический код таргетинга (был segment_name в Excel — не путать с поведенческими сегментами)
    target_code VARCHAR(200),

    -- Железо
    hardware_internet VARCHAR(200),
    hardware_internet_ownership VARCHAR(100),
    hardware_tv VARCHAR(200),
    hardware_tv_ownership VARCHAR(100),

    -- Скидки
    discount_abs DECIMAL(10,2),
    discount_pct DECIMAL(5,2),
    discount_period_months INTEGER,
    hardware_internet_discount_pct DECIMAL(5,2),
    hardware_tv_discount_pct DECIMAL(5,2),

    -- VAS (через запятую — для отображения; нормализованный список ниже через offer_vas)
    vas_names TEXT,

    -- Цены
    ap_with_nds DECIMAL(10,2),
    install_price_int DECIMAL(10,2),
    install_price_tv DECIMAL(10,2),

    -- Триал
    trial_days INTEGER,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offer_details_target_code ON offer_details(target_code);
CREATE INDEX IF NOT EXISTS idx_offer_details_trial_days ON offer_details(trial_days);

COMMENT ON TABLE offer_details IS 'Детальные параметры оффера: цены, железо, скидки, триал';
COMMENT ON COLUMN offer_details.target_code IS 'Технический код продуктового таргетинга (ex: router_ex710_own)';

-- ============================================================================
-- Таблица: availability_rules (Правила availability — кто может получить оффер)
-- ============================================================================
CREATE TABLE IF NOT EXISTS availability_rules (
    id SERIAL PRIMARY KEY,
    field_name VARCHAR(200) NOT NULL,
    sql_condition TEXT NOT NULL,
    is_actual BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_availability_rules_field_name ON availability_rules(field_name);

COMMENT ON TABLE availability_rules IS 'SQL-условия применимости офферов (из листа avp)';

-- ============================================================================
-- Готово
-- ============================================================================
SELECT 'Migration 10 (real data schema) applied successfully' AS status;
