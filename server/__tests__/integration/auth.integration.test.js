const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock database before importing app
jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { query: jest.fn(), on: jest.fn() }
}));

jest.mock('../../src/services/logService', () => ({
  logAction: jest.fn().mockResolvedValue(true),
  saveHistory: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(true)
}));

const app = require('../../src/app');
const { query } = require('../../src/config/database');
const { logAction } = require('../../src/services/logService');
const { generateToken, adminUser, JWT_SECRET } = require('../helpers/testSetup');

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  // ==================== REGISTER ====================
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      // No existing user
      query.mockResolvedValueOnce({ rows: [] });
      // Insert user
      query.mockResolvedValueOnce({
        rows: [{
          id: 10,
          username: 'newuser',
          email: 'newuser@test.com',
          created_at: new Date().toISOString()
        }]
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'newuser',
          email: 'newuser@test.com',
          password: 'Password1'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('newuser');
      expect(res.body.data.token).toBeDefined();

      // Verify token is valid
      const decoded = jwt.verify(res.body.data.token, JWT_SECRET);
      expect(decoded.userId).toBe(10);

      expect(logAction).toHaveBeenCalled();
    });

    it('should return 400 if user already exists', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'existinguser',
          email: 'existing@test.com',
          password: 'Password1'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid username (too short)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'ab',
          email: 'test@test.com',
          password: 'Password1'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'validuser',
          email: 'not-an-email',
          password: 'Password1'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'validuser',
          email: 'valid@test.com',
          password: 'weak'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for password without uppercase', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'validuser',
          email: 'valid@test.com',
          password: 'password1'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== LOGIN ====================
  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const password = 'Password1';
      const hashedPassword = await bcrypt.hash(password, 10);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          email: 'admin@test.com',
          password_hash: hashedPassword,
          is_active: true,
          role: 'Administrator',
          permissions: { offers: ['create', 'read', 'update', 'delete'] }
        }]
      });
      // Update last_login
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe('admin');
      expect(res.body.data.user.role).toBe('Administrator');
      expect(logAction).toHaveBeenCalled();
    });

    it('should return 401 for non-existent user', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'nobody', password: 'Password1' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correct', 10);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          password_hash: hashedPassword,
          is_active: true,
          role: 'Administrator',
          permissions: {}
        }]
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 for deactivated user', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'inactive',
          password_hash: 'hash',
          is_active: false,
          role: 'Operator',
          permissions: {}
        }]
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'inactive', password: 'Password1' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for missing username', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'Password1' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ username: 'admin' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== GET PROFILE ====================
  describe('GET /api/v1/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      const token = generateToken(1);

      // Auth middleware query
      query.mockResolvedValueOnce({ rows: [adminUser] });
      // Profile query
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          email: 'admin@test.com',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          role: 'Administrator',
          permissions: adminUser.permissions
        }]
      });

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.username).toBe('admin');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token-here');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '-1h' });

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 if user not found in DB', async () => {
      const token = generateToken(999);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== LOGOUT ====================
  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const token = generateToken(1);
      query.mockResolvedValueOnce({ rows: [adminUser] });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(logAction).toHaveBeenCalledWith(
        1, 'LOGOUT', 'User', 1, null, expect.anything()
      );
    });
  });

  // ==================== PASSWORD RESET ====================
  describe('POST /api/v1/auth/request-password-reset', () => {
    it('should return success message for existing email', async () => {
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'admin',
          email: 'admin@test.com',
          is_active: true
        }]
      });
      // Save reset token
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/request-password-reset')
        .send({ email: 'admin@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return success message even for non-existent email (security)', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/request-password-reset')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if email not provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/request-password-reset')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should return 400 if token missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ newPassword: 'NewPassword1' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if password too short', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'sometoken', newPassword: '123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if token is invalid', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'invalidtoken', newPassword: 'NewPassword1' });

      expect(res.status).toBe(400);
    });
  });
});
