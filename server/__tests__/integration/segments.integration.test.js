const request = require('supertest');

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
const {
  generateToken,
  adminUser,
  analystUser,
  operatorUser
} = require('../helpers/testSetup');

describe('Segments Integration Tests', () => {
  let adminToken;
  let analystToken;
  let operatorToken;

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
    adminToken = generateToken(adminUser.id);
    analystToken = generateToken(analystUser.id);
    operatorToken = generateToken(operatorUser.id);
  });

  const mockAuth = (user) => {
    query.mockResolvedValueOnce({ rows: [user] });
  };

  // ==================== GET SEGMENTS ====================
  describe('GET /api/v1/segments', () => {
    it('should return segments list', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Premium', description: 'Premium clients', is_active: true, offers_count: '3' },
          { id: 2, name: 'Economy', description: 'Economy clients', is_active: true, offers_count: '1' }
        ]
      });

      const res = await request(app)
        .get('/api/v1/segments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Premium');
    });

    it('should filter segments by is_active', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Active Segment', is_active: true, offers_count: '0' }]
      });

      const res = await request(app)
        .get('/api/v1/segments?is_active=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should search segments by name', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Premium VIP', is_active: true, offers_count: '2' }]
      });

      const res = await request(app)
        .get('/api/v1/segments?search=Premium')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ==================== GET SEGMENT BY ID ====================
  describe('GET /api/v1/segments/:id', () => {
    it('should return segment with offers', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Premium', description: 'Premium clients',
          is_active: true, criteria: { min_arpu: 1500 },
          offers: [{ id: 1, title: 'Offer 1', status: 'active' }]
        }]
      });

      const res = await request(app)
        .get('/api/v1/segments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Premium');
      expect(res.body.data.offers).toHaveLength(1);
    });

    it('should return 404 for non-existent segment', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/segments/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==================== CREATE SEGMENT ====================
  describe('POST /api/v1/segments', () => {
    const validSegment = {
      name: 'New Segment',
      description: 'A new test segment',
      criteria: { min_arpu: 500 },
      client_count: 100
    };

    it('should create segment with valid data', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{
          id: 5, ...validSegment,
          is_active: true, created_at: new Date().toISOString()
        }]
      });

      const res = await request(app)
        .post('/api/v1/segments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validSegment);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Segment');
      expect(logAction).toHaveBeenCalled();
    });

    it('should create segment with operator permissions', async () => {
      mockAuth(operatorUser);
      query.mockResolvedValueOnce({
        rows: [{ id: 6, ...validSegment, is_active: true }]
      });

      const res = await request(app)
        .post('/api/v1/segments')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send(validSegment);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should deny creation for read-only user', async () => {
      mockAuth(analystUser);

      const res = await request(app)
        .post('/api/v1/segments')
        .set('Authorization', `Bearer ${analystToken}`)
        .send(validSegment);

      expect(res.status).toBe(403);
    });

    it('should reject segment with empty name', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/segments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '', description: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== UPDATE SEGMENT ====================
  describe('PUT /api/v1/segments/:id', () => {
    it('should update segment', async () => {
      mockAuth(adminUser);
      // Get current state
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Old Name', is_active: true }]
      });
      // saveHistory
      query.mockResolvedValueOnce({ rows: [] });
      // UPDATE
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Updated Name', is_active: true }]
      });

      const res = await request(app)
        .put('/api/v1/segments/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent segment', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/v1/segments/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ==================== DELETE SEGMENT ====================
  describe('DELETE /api/v1/segments/:id', () => {
    it('should delete segment without linked offers (admin only)', async () => {
      mockAuth(adminUser);
      // Check linked offers
      query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Get current state
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'To Delete' }]
      });
      // DELETE (saveHistory and logAction are mocked at service level)
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'To Delete' }]
      });

      const res = await request(app)
        .delete('/api/v1/segments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if segment has linked offers', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      const res = await request(app)
        .delete('/api/v1/segments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should deny deletion for operator (admin only)', async () => {
      mockAuth(operatorUser);

      const res = await request(app)
        .delete('/api/v1/segments/1')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(403);
    });

    it('should deny deletion for read-only user', async () => {
      mockAuth(analystUser);

      const res = await request(app)
        .delete('/api/v1/segments/1')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });
  });
});
