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
const { query, getClient } = require('../../src/config/database');
const { logAction } = require('../../src/services/logService');
const {
  generateToken,
  adminUser,
  analystUser,
  operatorUser,
  createMockClient
} = require('../helpers/testSetup');

describe('Offers Integration Tests', () => {
  let adminToken;
  let analystToken;

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
    getClient.mockReset();
    adminToken = generateToken(adminUser.id);
    analystToken = generateToken(analystUser.id);
  });

  // Helper to setup auth mock
  const mockAuth = (user) => {
    query.mockResolvedValueOnce({ rows: [user] });
  };

  // ==================== GET OFFERS ====================
  describe('GET /api/v1/offers', () => {
    it('should return paginated offers list', async () => {
      mockAuth(adminUser);
      // Count query
      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // Offers query
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, title: 'Offer 1', description: 'Desc 1',
            offer_type: 'discount', status: 'active', priority: 80,
            start_date: '2025-01-01', end_date: null,
            created_at: new Date().toISOString(), segments: []
          },
          {
            id: 2, title: 'Offer 2', description: 'Desc 2',
            offer_type: 'bonus', status: 'draft', priority: 50,
            start_date: '2025-02-01', end_date: '2025-12-31',
            created_at: new Date().toISOString(), segments: []
          }
        ]
      });

      const res = await request(app)
        .get('/api/v1/offers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
    });

    it('should filter offers by status', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, title: 'Active Offer', status: 'active',
          offer_type: 'discount', priority: 80,
          start_date: '2025-01-01', segments: []
        }]
      });

      const res = await request(app)
        .get('/api/v1/offers?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/offers');

      expect(res.status).toBe(401);
    });
  });

  // ==================== GET OFFER BY ID ====================
  describe('GET /api/v1/offers/:id', () => {
    it('should return offer by id', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, title: 'Test Offer', description: 'Description',
          offer_type: 'discount', status: 'active', priority: 80,
          start_date: '2025-01-01', end_date: null,
          created_by_username: 'admin',
          segments: [], conditions: []
        }]
      });

      const res = await request(app)
        .get('/api/v1/offers/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Test Offer');
    });

    it('should return 404 for non-existent offer', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/offers/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid id', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .get('/api/v1/offers/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });
  });

  // ==================== CREATE OFFER ====================
  describe('POST /api/v1/offers', () => {
    const validOffer = {
      title: 'New Offer',
      description: 'New offer description',
      offer_type: 'discount',
      priority: 75,
      start_date: '2025-06-01T00:00:00.000Z',
      status: 'draft'
    };

    it('should create offer with admin permissions', async () => {
      mockAuth(adminUser);

      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 5, ...validOffer,
          created_by: 1, created_at: new Date().toISOString()
        }]
      }); // INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
      getClient.mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validOffer);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('New Offer');
      expect(logAction).toHaveBeenCalled();
    });

    it('should create offer with segment assignments', async () => {
      mockAuth(adminUser);

      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 6, ...validOffer, created_by: 1 }]
      }); // INSERT offer
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT segments
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
      getClient.mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validOffer, segment_ids: [1, 2] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should reject offer with invalid type', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validOffer, offer_type: 'invalid_type' });

      expect(res.status).toBe(400);
    });

    it('should reject offer with priority out of range', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...validOffer, priority: 200 });

      expect(res.status).toBe(400);
    });

    it('should reject offer with end_date before start_date', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validOffer,
          start_date: '2025-12-01T00:00:00.000Z',
          end_date: '2025-01-01T00:00:00.000Z'
        });

      expect(res.status).toBe(400);
    });

    it('should deny creation for read-only user', async () => {
      mockAuth(analystUser);

      const res = await request(app)
        .post('/api/v1/offers')
        .set('Authorization', `Bearer ${analystToken}`)
        .send(validOffer);

      expect(res.status).toBe(403);
    });
  });

  // ==================== UPDATE OFFER ====================
  describe('PUT /api/v1/offers/:id', () => {
    it('should update offer with admin permissions', async () => {
      mockAuth(adminUser);

      const mockClient = createMockClient();
      // Get current offer
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 1, title: 'Old Title', status: 'draft',
          offer_type: 'discount', priority: 50
        }]
      });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // saveHistory (internal)
      mockClient.query.mockResolvedValueOnce({
        rows: [{
          id: 1, title: 'Updated Title', status: 'active',
          offer_type: 'discount', priority: 50
        }]
      }); // UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
      getClient.mockResolvedValue(mockClient);

      const res = await request(app)
        .put('/api/v1/offers/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Title', status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent offer', async () => {
      mockAuth(adminUser);

      const mockClient = createMockClient();
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      getClient.mockResolvedValue(mockClient);

      const res = await request(app)
        .put('/api/v1/offers/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
    });

    it('should deny update for read-only user', async () => {
      mockAuth(analystUser);

      const res = await request(app)
        .put('/api/v1/offers/1')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ title: 'Hack' });

      expect(res.status).toBe(403);
    });
  });

  // ==================== DELETE OFFER ====================
  describe('DELETE /api/v1/offers/:id', () => {
    it('should delete offer with admin permissions', async () => {
      mockAuth(adminUser);
      // Get offer for logging
      query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'To Delete', status: 'draft' }]
      });
      // DELETE (saveHistory and logAction are mocked at service level)
      query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await request(app)
        .delete('/api/v1/offers/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(logAction).toHaveBeenCalled();
    });

    it('should return 404 for non-existent offer', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete('/api/v1/offers/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('should deny deletion for read-only user', async () => {
      mockAuth(analystUser);

      const res = await request(app)
        .delete('/api/v1/offers/1')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });
  });
});
