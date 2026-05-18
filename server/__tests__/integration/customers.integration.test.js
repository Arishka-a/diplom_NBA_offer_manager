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

describe('Customers Integration Tests', () => {
  let adminToken;
  let analystToken;

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
    adminToken = generateToken(adminUser.id);
    analystToken = generateToken(analystUser.id);
  });

  const mockAuth = (user) => {
    query.mockResolvedValueOnce({ rows: [user] });
  };

  // ==================== GET CUSTOMERS ====================
  describe('GET /api/v1/customers', () => {
    it('should return paginated customers list', async () => {
      mockAuth(adminUser);
      // Count
      query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      // Customers
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, first_name: 'Ivan', last_name: 'Petrov',
            email: 'ivan@test.com', arpu: 1200, tenure_months: 12,
            churn_score: 0.3, status: 'active', segment_name: 'Premium'
          },
          {
            id: 2, first_name: 'Anna', last_name: 'Sidorova',
            email: 'anna@test.com', arpu: 800, tenure_months: 6,
            churn_score: 0.7, status: 'active', segment_name: 'Economy'
          }
        ]
      });

      const res = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by status', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, first_name: 'Ivan', last_name: 'Petrov',
          status: 'active', arpu: 1200
        }]
      });

      const res = await request(app)
        .get('/api/v1/customers?status=active')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by ARPU range', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, first_name: 'Ivan', arpu: 1500, status: 'active'
        }]
      });

      const res = await request(app)
        .get('/api/v1/customers?min_arpu=1000&max_arpu=2000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should search by name/email', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'Ivan', last_name: 'Petrov', email: 'ivan@test.com' }]
      });

      const res = await request(app)
        .get('/api/v1/customers?search=Ivan')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should deny access without read permission', async () => {
      const noPermsUser = { ...operatorUser, permissions: {} };
      mockAuth(noPermsUser);

      const token = generateToken(noPermsUser.id);
      const res = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  // ==================== GET CUSTOMER BY ID ====================
  describe('GET /api/v1/customers/:id', () => {
    it('should return customer details', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, first_name: 'Ivan', last_name: 'Petrov',
          email: 'ivan@test.com', arpu: 1200, tenure_months: 12,
          churn_score: 0.3, status: 'active',
          segment_name: 'Premium',
          total_offers_shown: '5', total_offers_accepted: '2'
        }]
      });

      const res = await request(app)
        .get('/api/v1/customers/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Ivan');
      expect(res.body.data.segment_name).toBe('Premium');
    });

    it('should return 404 for non-existent customer', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/customers/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ==================== CREATE CUSTOMER ====================
  describe('POST /api/v1/customers', () => {
    const validCustomer = {
      first_name: 'Mikhail',
      last_name: 'Ivanov',
      email: 'mikhail@test.com',
      phone: '+79001234567',
      arpu: 1000,
      tenure_months: 6,
      churn_score: 0.2,
      segment_id: 1,
      status: 'active'
    };

    it('should create customer successfully', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{
          id: 10, ...validCustomer,
          created_at: new Date().toISOString()
        }]
      });

      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCustomer);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.first_name).toBe('Mikhail');
    });

    it('should return 400 for missing required fields', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ first_name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for duplicate email', async () => {
      mockAuth(adminUser);
      const error = new Error('duplicate key');
      error.code = '23505';
      query.mockRejectedValueOnce(error);

      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(validCustomer);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==================== UPDATE CUSTOMER ====================
  describe('PUT /api/v1/customers/:id', () => {
    it('should update customer', async () => {
      mockAuth(adminUser);
      // Get old data
      query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'Ivan', last_name: 'Petrov', email: 'ivan@test.com' }]
      });
      // UPDATE
      query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'Ivan', last_name: 'Petrov-Updated', email: 'ivan@test.com' }]
      });

      const res = await request(app)
        .put('/api/v1/customers/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ last_name: 'Petrov-Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent customer', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/v1/customers/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ first_name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when no data provided', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{ id: 1, first_name: 'Ivan' }]
      });

      const res = await request(app)
        .put('/api/v1/customers/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ==================== DELETE CUSTOMER ====================
  describe('DELETE /api/v1/customers/:id', () => {
    it('should delete customer', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'ivan@test.com' }]
      });

      const res = await request(app)
        .delete('/api/v1/customers/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent customer', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete('/api/v1/customers/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });
});
