require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing PostgreSQL connection...');
console.log('Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-3) : 'NOT SET');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nba_offermanager',
  user: process.env.DB_USER || 'nba_user',
  password: process.env.DB_PASSWORD || 'nbaDB123',
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Error details:', err);
  } else {
    console.log('✅ Connection successful!');
    console.log('Server time:', res.rows[0].now);
  }
  pool.end();
});
