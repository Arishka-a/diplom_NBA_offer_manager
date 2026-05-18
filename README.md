# NBA Offer Manager

Система управления офферами **Next Best Action** — веб-приложение для маркетологов и аналитиков, позволяющее формировать персонализированные офферы для клиентов, настраивать правила и сегменты, отслеживать эффективность кампаний на интерактивных дашбордах.

Проект разработан как выпускная квалификационная работа (ВКР). Заказчик — АО «ЭР-Телеком Холдинг».

---

## Стек

**Frontend:**
- React 19, React Router 7
- Context API + кастомные хуки
- Axios (с request/response interceptors)
- Recharts (визуализация данных)
- Vite, Vitest, ESLint

**Backend:**
- Node.js, Express.js
- PostgreSQL
- JWT-аутентификация
- bcrypt (хэширование паролей)
- nodemailer (email-уведомления)

**Инфраструктура:**
- Docker Compose (PostgreSQL + Adminer)

---

## Ключевые возможности

- **Ролевая модель доступа** — три роли: Administrator, Analyst, Operator.
- **Управление клиентами** — CRUD, импорт/экспорт CSV, Excel, PDF.
- **Сегментация** — конструктор условий (`FilterBuilder`, `ConditionManager`) для гибкого описания клиентских сегментов.
- **Офферы и правила** — настройка правил рекомендаций «Next Best Action» с приоритетами.
- **NBA Recommendations** — выдача персональных предложений на основе сегмента клиента и активных правил.
- **Дашборды** — интерактивная аналитика на Recharts (LineChart, BarChart, PieChart).
- **Отчёты** — построение и экспорт отчётов в PDF.
- **Логирование** — журнал действий пользователей с фильтрацией.
- **Аутентификация** — JWT, защищённые маршруты (`PrivateRoute`), сброс пароля по email.

---

## Архитектура

```
nba-offer-manager/
├── client/                 # React SPA (Vite)
│   └── src/
│       ├── pages/          # 18 страниц приложения
│       ├── components/     # Переиспользуемые компоненты
│       ├── services/       # 11 сервисов (Service Layer)
│       ├── context/        # AuthContext
│       └── __tests__/      # Vitest
├── server/                 # Node.js + Express
│   └── src/
│       ├── controllers/    # 11 контроллеров
│       ├── services/       # Бизнес-логика, PDF, email
│       ├── middleware/     # auth, validation, errorHandler
│       ├── routes/
│       ├── config/         # database, env-validator
│       └── utils/          # filterBuilder, fileParser
├── database/               # SQL-схема и начальные данные
├── docker-compose.yml      # PostgreSQL + Adminer
└── package.json            # Корневые скрипты (запуск client+server)
```

---

## Быстрый старт

### Предварительные требования
- Node.js 18+
- Docker и Docker Compose (для PostgreSQL)

### 1. Клонирование

```bash
git clone https://github.com/Arishka-a/diplom_NBA_offer_manager.git
cd diplom_NBA_offer_manager
```

### 2. Переменные окружения

```bash
cp .env.example .env
# отредактировать .env: задать DB_PASSWORD, JWT_SECRET и пр.
```

### 3. Установка зависимостей

```bash
npm run install-all
```

### 4. Запуск базы данных (Docker)

```bash
docker-compose up -d
```

Adminer доступен на http://localhost:8080.

Подробнее — в [`DOCKER_SETUP.md`](./DOCKER_SETUP.md).

### 5. Запуск приложения (dev-режим)

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

---

## Основные REST-эндпойнты (40+)

| Группа | Эндпойнты |
|---|---|
| Auth | `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` |
| Users | `/users` (CRUD, роли) |
| Customers | `/customers` (CRUD, поиск, фильтры) |
| Segments | `/segments`, `/conditions` |
| Offers | `/offers`, `/offers/:id/history` |
| Rules | `/rules`, `/rules/statistics` |
| NBA | `/nba/recommendations` |
| Reports | `/reports`, `/reports/export` |
| Import/Export | `/import`, `/export` (CSV, Excel, PDF) |
| Logs | `/logs` |
| Dashboard | `/dashboard/stats` |

---

## Что было реализовано

### Frontend
- SPA на React 19 с 18 страницами и переиспользуемыми компонентами
- Клиентский роутинг с защищёнными маршрутами (`PrivateRoute` HOC) и ролевым доступом
- Глобальное управление состоянием через Context API (`AuthContext`) + `useAuth`
- HTTP-клиент Axios с interceptors для авто-JWT и обработки ошибок
- 11 сервисных модулей для разделения API-логики и UI
- Интерактивные дашборды на Recharts
- CRUD с модальными окнами, debounce-поиском, фильтрацией, сортировкой, пагинацией
- Конструктор условий и фильтров для правил NBA
- Импорт/экспорт CSV, Excel, PDF с drag-and-drop
- Unit-тесты (Vitest) для критических компонентов

### Backend
- 11 контроллеров (auth, users, customers, segments, conditions, offers, rules, reports, logs, dashboard, NBA, import/export)
- Middleware: аутентификация (JWT), валидация, централизованная обработка ошибок
- Сервисы: NBA-логика, генерация PDF, email-уведомления, импорт/экспорт
- Утилита `filterBuilder` — построение SQL-фильтров из конструктора условий
- Валидация переменных окружения при старте

### Инфраструктура
- Docker Compose для PostgreSQL и Adminer
- Скрипты автоматического запуска (`start-all.bat`, `start-dev.bat`)
- Начальные данные (роли, тестовый администратор, сегменты, офферы)

---

## Автор

**Вахрушева Арина Владиславовна**
Студентка ПНИПУ, направление «Разработка информационных систем»
Telegram: [@arinaVah](https://t.me/arinaVah)

---

## Лицензия

MIT
