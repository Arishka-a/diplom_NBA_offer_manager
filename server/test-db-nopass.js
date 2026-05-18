const { Pool } = require('pg');

console.log('Testing database connection without password...');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  database: 'nba_offermanager',
  user: 'nba_user',
  password: '', // Empty password
});

pool.query('SELECT NOW(), current_user, current_database()', (err, res) => {
  if (err) {
    console.error('❌ Connection error:');
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    process.exit(1);
  }

  console.log('✅ Connection successful!');
  console.log('Result:', res.rows[0]);
  pool.end();
});
