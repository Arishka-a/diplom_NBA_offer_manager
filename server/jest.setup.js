// Jest setup file
// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(10000);

// Mock console.error to reduce noise in tests (optional)
// global.console.error = jest.fn();
