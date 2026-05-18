require('dotenv').config();

// Validate environment variables before anything else
const { validateEnv } = require('./config/env-validator');
validateEnv();

const app = require('./app');
const { pool } = require('./config/database');
const { cleanupDeactivatedUsers } = require('./controllers/userController');

const PORT = process.env.PORT || 3001;

// ============================================================================
// SERVER START
// ============================================================================

const startServer = async () => {
  try {
    // Проверка подключения к БД
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');

    // Автоматическое применение миграций
    try {
      // Поле deactivated_at для пользователей
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP DEFAULT NULL
      `);
      console.log('✅ Migration: deactivated_at field ready');

      // Таблица взаимодействий клиентов с офферами
      await pool.query(`
        CREATE TABLE IF NOT EXISTS customer_offer_interactions (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
          offer_id INTEGER REFERENCES offers(id) ON DELETE CASCADE,
          action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'accept', 'reject', 'dismiss')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB DEFAULT '{}'
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_coi_customer_id ON customer_offer_interactions(customer_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_coi_offer_id ON customer_offer_interactions(offer_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_coi_action ON customer_offer_interactions(action)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_coi_created_at ON customer_offer_interactions(created_at)`);
      console.log('✅ Migration: customer_offer_interactions table ready');
    } catch (migrationErr) {
      console.log('ℹ️ Migration check:', migrationErr.message);
    }

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 NBA-OfferManager API Server                      ║
║                                                       ║
║   Server:  http://localhost:${PORT}                    ║
║   API:     http://localhost:${PORT}/api/v1             ║
║   Health:  http://localhost:${PORT}/api/v1/health      ║
║                                                       ║
║   Environment: ${process.env.NODE_ENV || 'development'}                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);

      // Запуск автоматической очистки деактивированных пользователей
      // Запускается сразу при старте и потом каждые 24 часа
      console.log('🔄 Запуск автоматической очистки деактивированных пользователей...');
      cleanupDeactivatedUsers();

      // Запускать очистку каждые 24 часа (86400000 мс)
      setInterval(() => {
        console.log('🔄 Запланированная очистка деактивированных пользователей...');
        cleanupDeactivatedUsers();
      }, 24 * 60 * 60 * 1000);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, shutting down...');
  await pool.end();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('🔄 Process will exit...');
  process.exit(1);
});
