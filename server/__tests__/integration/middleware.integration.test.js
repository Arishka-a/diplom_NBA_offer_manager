const request = require('supertest');
const jwt = require('jsonwebtoken');

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
const {
  generateToken,
  generateExpiredToken,
  adminUser,
  analystUser,
  operatorUser,
  deactivatedUser,
  JWT_SECRET
} = require('../helpers/testSetup');

describe('Middleware Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  const mockAuth = (user) => {
    query.mockResolvedValueOnce({ rows: [user] });
  };

  // ==================== AUTHENTICATION ====================
  describe('Authentication Middleware', () => {
    it('should reject request without Authorization header', async () => {
      const res = await request(app).get('/api/v1/offers');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with invalid token format', async () => {
      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', 'InvalidFormat token123');

      // 'InvalidFormat token123'.split(' ')[1] = 'token123' which jwt.verify rejects as invalid
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with malformed JWT', async () => {
      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', 'Bearer not.a.valid.jwt');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with expired token', async () => {
      const expiredToken = generateExpiredToken(1);

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject request with token signed by wrong secret', async () => {
      const wrongToken = jwt.sign({ userId: 1 }, 'wrong-secret', { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${wrongToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should reject request if user not found in DB', async () => {
      const token = generateToken(999);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should reject request if user is deactivated', async () => {
      const token = generateToken(deactivatedUser.id);
      mockAuth(deactivatedUser);

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should accept valid token and proceed', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);

      // Count query (for offers endpoint)
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Offers query
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  // ==================== ROLE-BASED ACCESS ====================
  describe('Role-Based Access Control', () => {
    it('should allow admin to access admin-only routes', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);
      // Users list query
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      query.mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin' }] });

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should deny operator access to admin-only routes (users management)', async () => {
      const token = generateToken(operatorUser.id);
      mockAuth(operatorUser);

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should deny non-admin access to admin-only routes', async () => {
      const token = generateToken(analystUser.id);
      mockAuth(analystUser);

      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should deny segment deletion for non-admin roles', async () => {
      const token = generateToken(operatorUser.id);
      mockAuth(operatorUser);

      const res = await request(app)
        .delete('/api/v1/segments/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== PERMISSION-BASED ACCESS ====================
  describe('Permission-Based Access Control', () => {
    it('should deny create permission when user only has read', async () => {
      const token = generateToken(analystUser.id);
      mockAuth(analystUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test', description: 'Test', offer_type: 'discount',
          priority: 50, start_date: '2025-01-01T00:00:00.000Z'
        });

      expect(res.status).toBe(403);
    });

    it('should deny update permission when user only has read', async () => {
      const token = generateToken(analystUser.id);
      mockAuth(analystUser);

      const res = await request(app)
        .put('/api/v1/offers/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should deny delete permission when user only has read', async () => {
      const token = generateToken(analystUser.id);
      mockAuth(analystUser);

      const res = await request(app)
        .delete('/api/v1/offers/1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should allow read permission for read-only user on offers', async () => {
      const token = generateToken(analystUser.id);
      mockAuth(analystUser);
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should deny access when user has no permissions for resource', async () => {
      const noPermsUser = {
        ...operatorUser,
        id: 10,
        permissions: { offers: ['read'] } // only offers, no logs
      };

      const token = generateToken(noPermsUser.id);
      mockAuth(noPermsUser);

      const res = await request(app)
        .get('/api/v1/logs')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== VALIDATION MIDDLEWARE ====================
  describe('Validation Middleware', () => {
    it('should validate offer type enum', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test', description: 'Test',
          offer_type: 'INVALID', priority: 50,
          start_date: '2025-01-01T00:00:00.000Z'
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should validate priority range (1-100)', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test', description: 'Test',
          offer_type: 'discount', priority: 0,
          start_date: '2025-01-01T00:00:00.000Z'
        });

      expect(res.status).toBe(400);
    });

    it('should validate ID parameter as positive integer', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);

      const res = await request(app)
        .get('/api/v1/offers/-1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('should validate start_date as ISO 8601', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test', description: 'Test',
          offer_type: 'discount', priority: 50,
          start_date: 'not-a-date'
        });

      expect(res.status).toBe(400);
    });

    it('should validate register password strength', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'validuser',
          email: 'valid@test.com',
          password: 'nouppercase1'
        });

      expect(res.status).toBe(400);
    });

    it('should validate segment name length', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/segments')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== ERROR HANDLING ====================
  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should handle database errors gracefully', async () => {
      const token = generateToken(adminUser.id);
      mockAuth(adminUser);
      query.mockRejectedValueOnce(new Error('Database connection lost'));

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== HEALTH CHECK ====================
  describe('Health Check', () => {
    it('should return health status without auth', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ==================== ROOT ENDPOINT ====================
  describe('Root Endpoint', () => {
    it('should return API info', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('NBA-OfferManager API');
      expect(res.body.version).toBe('1.0.0');
    });
  });
});
