/**
 * Script to generate bcrypt password hash for admin user
 *
 * Usage:
 *   node generate-admin-password.js "YourSecurePassword"
 *
 * Then copy the generated hash to 01_init.sql
 */

const bcrypt = require('bcrypt');

const password = process.argv[2] || 'Admin123!';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }

  console.log('\n=== BCRYPT PASSWORD HASH GENERATED ===');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nCopy this hash to database/docker-entrypoint-initdb.d/01_init.sql');
  console.log('Replace the password_hash value in the admin user INSERT statement.\n');
});
