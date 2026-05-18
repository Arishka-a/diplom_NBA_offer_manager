-- Migration: Extend seed data up to 20 segments and 200 customers
-- Created: 2026-04-22
-- Description:
--   Добавляет 14 дополнительных сегментов (к уже существующим 6) и 180 клиентов
--   (к существующим 20), чтобы в базе было 20 сегментов и 200 клиентов.
--   Идемпотентна — можно запускать повторно без дублей (ON CONFLICT по name/email).

SET client_encoding = 'UTF8';

-- ============================================================================
-- 1. Сегменты (добавляем до 20)
-- ============================================================================
-- Для стабильной работы ON CONFLICT нужен уникальный индекс по name.
-- На случай, если индекса ещё нет — создаём его идемпотентно.
CREATE UNIQUE INDEX IF NOT EXISTS uq_segments_name ON segments(name);

INSERT INTO segments (name, description, criteria, client_count) VALUES
  ('Молодёжь 18-25', 'Клиенты возрастом от 18 до 25 лет',
   '{"age": {"operator": "between", "value": [18, 25]}}'::jsonb, 12500),
  ('Семейные клиенты', 'Клиенты с семейными тарифами',
   '{"plan_type": {"operator": "=", "value": "family"}}'::jsonb, 23400),
  ('Бизнес-клиенты', 'Корпоративные клиенты (B2B)',
   '{"segment_type": {"operator": "=", "value": "b2b"}}'::jsonb, 4200),
  ('Студенты', 'Клиенты со студенческим тарифом',
   '{"has_student_discount": true}'::jsonb, 8900),
  ('Пенсионеры', 'Клиенты пенсионного возраста (60+)',
   '{"age": {"operator": ">=", "value": 60}}'::jsonb, 14200),
  ('Высокий трафик', 'Клиенты с высоким потреблением трафика (>=500 ГБ/мес)',
   '{"monthly_traffic_gb": {"operator": ">=", "value": 500}}'::jsonb, 18600),
  ('Низкий трафик', 'Клиенты с низким потреблением трафика (<50 ГБ/мес)',
   '{"monthly_traffic_gb": {"operator": "<", "value": 50}}'::jsonb, 22100),
  ('Мультипродукт', 'Клиенты с 3+ продуктами',
   '{"products_count": {"operator": ">=", "value": 3}}'::jsonb, 9800),
  ('Только мобильная связь', 'Клиенты только с мобильной связью',
   '{"products": ["mobile"]}'::jsonb, 31200),
  ('Только ТВ', 'Клиенты только с ТВ-подключением',
   '{"products": ["tv"]}'::jsonb, 6700),
  ('Региональные клиенты', 'Клиенты из регионов (не Москва/СПб)',
   '{"location_type": "region"}'::jsonb, 52300),
  ('Премиум ТВ', 'Подписчики премиум ТВ-пакетов',
   '{"tv_package": "premium"}'::jsonb, 5600),
  ('Постоплата', 'Клиенты на постоплатной системе расчётов',
   '{"billing_type": "postpaid"}'::jsonb, 74500),
  ('Предоплата', 'Клиенты на предоплатной системе расчётов',
   '{"billing_type": "prepaid"}'::jsonb, 28400)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 2. Клиенты (добираем до 200)
-- ============================================================================
DO $$
DECLARE
  first_names TEXT[] := ARRAY[
    'Артём','Борис','Валерий','Глеб','Даниил','Евгений','Захар','Игорь',
    'Кирилл','Леонид','Марат','Николай','Олег','Пётр','Роман','Степан',
    'Тимур','Фёдор','Юрий','Ярослав','Арсений','Богдан','Вадим','Денис',
    'Егор','Илья','Константин','Матвей',
    'Альбина','Валентина','Галина','Диана','Евгения','Жанна','Зоя','Инна',
    'Карина','Лариса','Маргарита','Нина','Оксана','Полина','Раиса','София',
    'Тамара','Ульяна','Фаина','Юлия','Алиса','Вера','Дарья','Ксения',
    'Марина','Надежда','Олеся','Регина'
  ];
  last_names TEXT[] := ARRAY[
    'Алексеев','Борисов','Васнецов','Горбунов','Давыдов','Ершов','Жуков',
    'Зайцев','Ильин','Карпов','Лукин','Маслов','Назаров','Осипов','Поляков',
    'Родионов','Савельев','Тихонов','Устинов','Фролов','Хохлов','Цветков',
    'Чернов','Шубин','Щукин','Юдин','Якимов','Авдеев','Беляев','Гусев',
    'Дорохов','Ефимов','Зверев','Исаев','Киреев','Лазарев','Медведев',
    'Новосёлов','Пантелеев','Рябов','Семёнов','Токарев','Ушаков','Филиппов'
  ];
  statuses TEXT[] := ARRAY['active','active','active','active','active','active','inactive','suspended','churned'];
  segment_ids INT[];
  i INT;
  fn TEXT;
  ln TEXT;
  em TEXT;
  ph TEXT;
  arpu_val NUMERIC;
  tenure INT;
  churn NUMERIC;
  seg INT;
  st TEXT;
  reg_int INT;
  act_int INT;
  inserted INT := 0;
BEGIN
  -- Берём все существующие сегменты (включая только что добавленные)
  SELECT array_agg(id ORDER BY id) INTO segment_ids FROM segments;

  FOR i IN 1..180 LOOP
    -- Псевдослучайные, но воспроизводимые значения через модульную арифметику
    fn := first_names[1 + (i * 7) % array_length(first_names, 1)];
    ln := last_names[1 + (i * 11) % array_length(last_names, 1)];
    em := 'customer' || LPAD((i + 100)::TEXT, 4, '0') || '@example.com';
    ph := '+7901' || LPAD((1000000 + i * 37)::TEXT, 7, '0');
    arpu_val := 300 + (i * 37) % 2500;                              -- 300..2800
    tenure := (i * 13) % 72;                                        -- 0..71 мес.
    churn := ROUND(((i * 17) % 100)::NUMERIC / 100.0, 2);           -- 0.00..0.99
    -- ~80% клиентов имеют сегмент, ~20% — NULL
    IF (i % 5) = 0 THEN
      seg := NULL;
    ELSE
      seg := segment_ids[1 + (i * 3) % array_length(segment_ids, 1)];
    END IF;
    st := statuses[1 + (i * 5) % array_length(statuses, 1)];
    reg_int := 1 + (i * 2) % 72;                                    -- 1..72 мес. назад
    act_int := 1 + (i * 2) % 30;                                    -- 1..30 дней назад

    INSERT INTO customers (
      first_name, last_name, email, phone,
      arpu, tenure_months, churn_score, segment_id, status,
      registered_at, last_activity_at
    ) VALUES (
      fn, ln, em, ph,
      arpu_val, tenure, churn, seg, st,
      NOW() - (reg_int || ' months')::INTERVAL,
      NOW() - (act_int || ' days')::INTERVAL
    )
    ON CONFLICT (email) DO NOTHING;

    IF FOUND THEN
      inserted := inserted + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Inserted % new customers', inserted;
END $$;

-- ============================================================================
-- 3. Отчёт по итогам
-- ============================================================================
SELECT 'Total segments: '  || COUNT(*)::TEXT AS result FROM segments
UNION ALL
SELECT 'Total customers: ' || COUNT(*)::TEXT FROM customers;
