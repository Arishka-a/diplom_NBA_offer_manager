require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing database connection...');
console.log('DB Config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? '***' : 'NOT SET'
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nba_offermanager',
  user: process.env.DB_USER || 'nba_user',
  password: process.env.DB_PASSWORD || 'nbaDB123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.query('SELECT NOW(), current_user, current_database()', (err, res) => {
  if (err) {
    console.error('❌ Connection error:');
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    process.exit(1);
  }

  console.log('✅ Connection successful!');
  console.log('Result:', res.rows[0]);
  pool.end();
});
