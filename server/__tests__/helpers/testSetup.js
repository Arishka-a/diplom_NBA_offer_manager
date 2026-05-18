const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

// Admin user with full permissions
const adminUser = {
  id: 1,
  username: 'admin',
  email: 'admin@test.com',
  is_active: true,
  role: 'Administrator',
  permissions: {
    offers: ['create', 'read', 'update', 'delete'],
    segments: ['create', 'read', 'update', 'delete'],
    customers: ['create', 'read', 'update', 'delete'],
    rules: ['create', 'read', 'update', 'delete'],
    logs: ['read'],
    reports: ['read'],
    import: ['execute'],
    users: ['create', 'read', 'update', 'delete']
  }
};

// Operator user with read-only permissions (for testing permission restrictions)
const analystUser = {
  id: 2,
  username: 'readonly_operator',
  email: 'readonly@test.com',
  is_active: true,
  role: 'Operator',
  permissions: {
    offers: ['read'],
    segments: ['read'],
    customers: ['read'],
    rules: ['read'],
    logs: ['read'],
    reports: ['read']
  }
};

// Operator user with create/update permissions
const operatorUser = {
  id: 3,
  username: 'operator',
  email: 'operator@test.com',
  is_active: true,
  role: 'Operator',
  permissions: {
    offers: ['create', 'read', 'update', 'delete'],
    segments: ['create', 'read', 'update'],
    customers: ['create', 'read', 'update', 'delete'],
    rules: ['create', 'read', 'update', 'delete'],
    import: ['execute']
  }
};

// Deactivated user
const deactivatedUser = {
  id: 4,
  username: 'deactivated',
  email: 'deactivated@test.com',
  is_active: false,
  role: 'Operator',
  permissions: {}
};

/**
 * Generate a valid JWT token for a user
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
};

/**
 * Generate an expired JWT token
 */
const generateExpiredToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '-1h' });
};

/**
 * Create a mock database client for transactions
 */
const createMockClient = () => ({
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  release: jest.fn()
});

/**
 * Setup auth mock: configure the DB query mock to return the given user
 * when the auth middleware looks up the user by token
 */
const setupAuthMock = (queryMock, user) => {
  // The auth middleware does a SELECT query to get the user
  // We intercept calls where the SQL contains 'FROM users u' and 'JOIN roles r'
  const originalImplementation = queryMock.getMockImplementation();

  queryMock.mockImplementation((sql, params) => {
    // Auth middleware query pattern
    if (typeof sql === 'string' && sql.includes('FROM users u') && sql.includes('JOIN roles r') && sql.includes('WHERE u.id')) {
      return Promise.resolve({ rows: user ? [user] : [] });
    }
    // Fall through to default or original
    if (originalImplementation) {
      return originalImplementation(sql, params);
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
};

module.exports = {
  JWT_SECRET,
  adminUser,
  analystUser,
  operatorUser,
  deactivatedUser,
  generateToken,
  generateExpiredToken,
  createMockClient,
  setupAuthMock
};
