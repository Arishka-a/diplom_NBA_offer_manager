# Миграции базы данных

## Описание

Этот каталог содержит SQL-миграции для обновления схемы базы данных NBA-OfferManager.

## Порядок выполнения

Миграции нумеруются по порядку и выполняются последовательно:

1. `01_init.sql` - начальная схема (уже выполнена через docker-entrypoint-initdb.d)
2. `02_add_rules_table.sql` - добавление таблицы правил NBA

## Как применить миграцию

### Вариант 1: Через psql (если PostgreSQL запущен)

```bash
# Из корня проекта
psql -U nba_user -d nba_offermanager -h localhost -p 5432 -f database/migrations/02_add_rules_table.sql
```

Пароль: `nbaDB123` (из .env файла)

### Вариант 2: Через Docker

```bash
# Скопировать миграцию в контейнер
docker cp database/migrations/02_add_rules_table.sql nba-offer-manager-db-1:/tmp/

# Выполнить миграцию
docker exec -i nba-offer-manager-db-1 psql -U nba_user -d nba_offermanager -f /tmp/02_add_rules_table.sql
```

### Вариант 3: Через Adminer (веб-интерфейс)

1. Откройте http://localhost:8080
2. Войдите с учетными данными:
   - Система: PostgreSQL
   - Сервер: db
   - Пользователь: nba_user
   - Пароль: nbaDB123
   - База данных: nba_offermanager
3. Перейдите в SQL команда
4. Скопируйте содержимое файла `02_add_rules_table.sql`
5. Вставьте и нажмите "Выполнить"

## Проверка применения миграции

После выполнения проверьте, что таблицы созданы:

```sql
-- Проверка наличия таблиц
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'rule%';

-- Должно вернуть:
-- rules
-- rule_executions

-- Проверка данных
SELECT COUNT(*) as total_rules FROM rules;
-- Должно быть 6 примеров правил

-- Проверка прав доступа в ролях
SELECT name, permissions->'rules' as rules_permissions FROM roles;
```

## Структура таблицы rules

### Поля таблицы

- **id** - уникальный идентификатор правила
- **name** - название правила
- **description** - описание правила
- **rule_type** - тип правила (priority_boost, scoring, filtering, segmentation, timing, budget, frequency, conversion)
- **is_active** - активность правила
- **priority** - приоритет (1-100)
- **weight** - вес для расчета score (0.0-1.0)
- **rule_definition** - JSON с определением правила
- **apply_conditions** - JSON с условиями применения
- **target_segments** - массив ID сегментов (NULL = все)
- **target_offer_types** - массив типов офферов (NULL = все)
- **created_by** - кто создал правило
- **created_at** - дата создания
- **updated_at** - дата обновления

### Типы правил

1. **priority_boost** - повышение приоритета для определенных условий
2. **scoring** - расчет score на основе формул
3. **filtering** - фильтрация офферов
4. **segmentation** - правила сегментации
5. **timing** - временные правила (время суток, дни недели)
6. **budget** - бюджетные ограничения
7. **frequency** - частота показа офферов
8. **conversion** - правила на основе конверсии

### Примеры правил в начальных данных

1. Приоритет для VIP клиентов (+20% к score)
2. Приоритет удержания при оттоке (динамический boost)
3. Лимит частоты показов (не более 3 раз за 30 дней)
4. Бюджетное ограничение (снижение при расходе 80% бюджета)
5. Boost в рабочее время (+15 очков 10:00-18:00)
6. Приоритет высококонверсионным (x1.25 при конверсии >10%)

## Откат миграции

Если нужно откатить миграцию:

```sql
-- Удалить представление
DROP VIEW IF EXISTS v_rule_statistics CASCADE;

-- Удалить функции
DROP FUNCTION IF EXISTS get_active_rules_for_offer(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_base_score(INTEGER) CASCADE;

-- Удалить триггеры
DROP TRIGGER IF EXISTS trigger_rules_updated_at ON rules;

-- Удалить таблицы
DROP TABLE IF EXISTS rule_executions CASCADE;
DROP TABLE IF EXISTS rules CASCADE;

-- Откатить права доступа
UPDATE roles SET permissions = permissions - 'rules' WHERE name IN ('Administrator', 'Operator');
```

## Следующие шаги

После применения миграции необходимо:

1. Создать backend контроллер для работы с правилами (`server/src/controllers/ruleController.js`)
2. Создать сервис NBA алгоритма (`server/src/services/nbaService.js`)
3. Создать API endpoints для правил
4. Создать frontend для управления правилами (`client/src/pages/Rules.jsx`)
5. Реализовать алгоритм расчета score с применением правил
