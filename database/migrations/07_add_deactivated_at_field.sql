-- Миграция: добавление поля deactivated_at для автоматического удаления пользователей
-- Дата: 2026-01-18

-- Добавляем поле deactivated_at в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP DEFAULT NULL;

-- Создаём индекс для быстрого поиска деактивированных пользователей
CREATE INDEX IF NOT EXISTS idx_users_deactivated_at ON users(deactivated_at) WHERE deactivated_at IS NOT NULL;

-- Комментарий к полю
COMMENT ON COLUMN users.deactivated_at IS 'Дата деактивации пользователя. Через 60 дней после деактивации пользователь удаляется автоматически.';
