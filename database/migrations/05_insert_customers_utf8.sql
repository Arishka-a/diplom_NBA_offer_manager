-- Insert sample customers data with proper UTF-8 encoding
SET client_encoding = 'UTF8';

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

SELECT 'Inserted ' || COUNT(*) || ' customers' as result FROM customers;
