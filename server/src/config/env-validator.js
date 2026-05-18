/**
 * Environment variable validation
 * Validates required environment variables at startup
 */

const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'PORT'
];

const optionalEnvVars = {
  'NODE_ENV': 'development',
  'CORS_ORIGIN': 'http://localhost:3000'
};

/**
 * Validate that all required environment variables are set
 * @throws {Error} If any required environment variable is missing
 */
const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Set defaults for optional variables
  for (const [varName, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
      warnings.push(`${varName} not set, using default: ${defaultValue}`);
    }
  }

  // Check for weak JWT secret
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET is too short. Use at least 32 characters for production.');
  }

  // Check for default/weak JWT secret
  if (process.env.JWT_SECRET &&
      (process.env.JWT_SECRET.includes('change') ||
       process.env.JWT_SECRET.includes('secret') ||
       process.env.JWT_SECRET.includes('your-'))) {
    warnings.push('JWT_SECRET appears to be a placeholder. Please use a strong, random secret in production.');
  }

  // Check for production environment
  if (process.env.NODE_ENV === 'production') {
    // Additional production checks
    if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.length < 12) {
      warnings.push('DB_PASSWORD is too short for production. Use at least 12 characters.');
    }
  }

  // Report warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Configuration Warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }

  // Throw error if required variables are missing
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      `Please set these variables in your .env file.`
    );
  }

  console.log('✅ Environment variables validated successfully');
};

module.exports = { validateEnv };
