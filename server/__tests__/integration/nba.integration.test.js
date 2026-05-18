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
const { generateToken, adminUser, analystUser } = require('../helpers/testSetup');

describe('NBA Recommendations Integration Tests', () => {
  let adminToken;

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
    adminToken = generateToken(adminUser.id);
  });

  const mockAuth = (user) => {
    query.mockResolvedValueOnce({ rows: [user] });
  };

  // ==================== GET CUSTOMER RECOMMENDATIONS ====================
  describe('GET /api/v1/nba/recommendations/:customerId', () => {
    it('should return recommendations for a customer', async () => {
      mockAuth(adminUser);

      // Customer query
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, first_name: 'Ivan', last_name: 'Petrov',
          email: 'ivan@test.com', arpu: 1200, tenure_months: 12,
          churn_score: 0.3, status: 'active', segment_id: 1,
          segment_name: 'Premium'
        }]
      });

      // Active offers for segment
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, title: 'Discount 20%', description: 'Special discount',
            offer_type: 'discount', priority: 80,
            start_date: '2025-01-01', end_date: null,
            segments: [{ id: 1, name: 'Premium' }]
          },
          {
            id: 2, title: 'Premium Upgrade', description: 'Upgrade offer',
            offer_type: 'upgrade', priority: 70,
            start_date: '2025-01-01', end_date: null,
            segments: [{ id: 1, name: 'Premium' }]
          }
        ]
      });

      // Excluded offers (history)
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/nba/recommendations/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customer_id).toBe(1);
      expect(res.body.data.recommendations).toBeDefined();
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
      expect(res.body.data.generated_at).toBeDefined();

      // Verify recommendations have NBA scores
      if (res.body.data.recommendations.length > 0) {
        const rec = res.body.data.recommendations[0];
        expect(rec.nba_score).toBeDefined();
        expect(rec.recommendation_reasons).toBeDefined();
        expect(rec.customer_profile).toBeDefined();
      }
    });

    it('should return 500 when customer not found', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] }); // Customer not found

      const res = await request(app)
        .get('/api/v1/nba/recommendations/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should respect limit parameter', async () => {
      mockAuth(adminUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1, first_name: 'Ivan', arpu: 1200, tenure_months: 12,
          churn_score: 0.3, segment_id: 1, segment_name: 'Premium'
        }]
      });

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Offer 1', offer_type: 'discount', priority: 80, segments: [] },
          { id: 2, title: 'Offer 2', offer_type: 'bonus', priority: 70, segments: [] },
          { id: 3, title: 'Offer 3', offer_type: 'upgrade', priority: 60, segments: [] }
        ]
      });

      query.mockResolvedValueOnce({ rows: [] }); // history

      const res = await request(app)
        .get('/api/v1/nba/recommendations/1?limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.recommendations.length).toBeLessThanOrEqual(2);
    });

    it('should exclude rejected offers from recommendations', async () => {
      mockAuth(adminUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1, first_name: 'Ivan', arpu: 1200, tenure_months: 12,
          churn_score: 0.3, segment_id: 1, segment_name: 'Premium'
        }]
      });

      query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Offer 1', offer_type: 'discount', priority: 80, segments: [] },
          { id: 2, title: 'Offer 2', offer_type: 'bonus', priority: 70, segments: [] }
        ]
      });

      // Offer 1 was rejected
      query.mockResolvedValueOnce({ rows: [{ offer_id: 1 }] });

      const res = await request(app)
        .get('/api/v1/nba/recommendations/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const offerIds = res.body.data.recommendations.map(r => r.id);
      expect(offerIds).not.toContain(1);
    });
  });

  // ==================== GET SEGMENT RECOMMENDATIONS ====================
  describe('GET /api/v1/nba/recommendations/segment/:segmentId', () => {
    it('should return recommendations for a segment', async () => {
      mockAuth(adminUser);

      // Segment info with customer stats
      query.mockResolvedValueOnce({
        rows: [{
          id: 1, name: 'Premium', description: 'Premium clients',
          customer_count: '50', avg_arpu: '1500',
          avg_tenure_months: '18', avg_churn_score: '0.25'
        }]
      });

      // Active offers
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, title: 'Premium Offer', offer_type: 'upgrade',
            priority: 90, segments: [{ id: 1, name: 'Premium' }]
          }
        ]
      });

      const res = await request(app)
        .get('/api/v1/nba/recommendations/segment/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.segment_id).toBe(1);
      expect(res.body.data.recommendations).toBeDefined();

      if (res.body.data.recommendations.length > 0) {
        const rec = res.body.data.recommendations[0];
        expect(rec.nba_score).toBeDefined();
        expect(rec.segment_profile).toBeDefined();
        expect(rec.segment_profile.segment_name).toBe('Premium');
      }
    });

    it('should return 500 when segment not found', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/nba/recommendations/segment/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
    });
  });

  // ==================== RECORD SHOWN ====================
  describe('POST /api/v1/nba/record-shown', () => {
    it('should record offer shown to customer', async () => {
      mockAuth(adminUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1, customer_id: 1, offer_id: 5,
          status: 'shown', channel: 'web',
          shown_at: new Date().toISOString()
        }]
      });

      const res = await request(app)
        .post('/api/v1/nba/record-shown')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customer_id: 1, offer_id: 5, channel: 'web' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('shown');
      expect(logAction).toHaveBeenCalled();
    });

    it('should return 400 for missing required fields', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .post('/api/v1/nba/record-shown')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ customer_id: 1 }); // missing offer_id

      expect(res.status).toBe(400);
    });
  });

  // ==================== UPDATE STATUS ====================
  describe('PUT /api/v1/nba/update-status/:historyId', () => {
    it('should update offer status to accepted', async () => {
      mockAuth(adminUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1, customer_id: 1, offer_id: 5,
          status: 'accepted', accepted_at: new Date().toISOString()
        }]
      });

      const res = await request(app)
        .put('/api/v1/nba/update-status/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'accepted' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(logAction).toHaveBeenCalled();
    });

    it('should update offer status to rejected', async () => {
      mockAuth(adminUser);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1, status: 'rejected', rejected_at: new Date().toISOString()
        }]
      });

      const res = await request(app)
        .put('/api/v1/nba/update-status/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid status', async () => {
      mockAuth(adminUser);

      const res = await request(app)
        .put('/api/v1/nba/update-status/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // ==================== GET CUSTOMER STATS ====================
  describe('GET /api/v1/nba/stats/:customerId', () => {
    it('should return NBA stats for customer', async () => {
      mockAuth(adminUser);

      query.mockResolvedValueOnce({
        rows: [{
          total_offers_shown: '10',
          accepted_count: '4',
          rejected_count: '3',
          pending_count: '3',
          conversion_rate: '57.14'
        }]
      });

      const res = await request(app)
        .get('/api/v1/nba/stats/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_offers_shown).toBe('10');
      expect(res.body.data.conversion_rate).toBe('57.14');
    });
  });

  // ==================== GET SEGMENT STATS ====================
  describe('GET /api/v1/nba/stats/segment/:segmentId', () => {
    it('should return NBA stats for segment', async () => {
      mockAuth(adminUser);

      // Segment info
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Premium', description: 'Premium clients' }]
      });

      // Aggregated stats
      query.mockResolvedValueOnce({
        rows: [{
          customers_engaged: '20',
          total_offers_shown: '100',
          accepted_count: '40',
          rejected_count: '30',
          pending_count: '30',
          conversion_rate: '57.14',
          unique_offers_shown: '15'
        }]
      });

      // Customer count
      query.mockResolvedValueOnce({
        rows: [{ total_customers: '50' }]
      });

      // Top offers
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Best Offer', offer_type: 'discount', shown_count: '30', accepted_count: '15', conversion_rate: '50.00' }
        ]
      });

      const res = await request(app)
        .get('/api/v1/nba/stats/segment/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.segment.name).toBe('Premium');
      expect(res.body.data.overall_stats).toBeDefined();
      expect(res.body.data.top_offers).toBeDefined();
    });

    it('should return 500 for non-existent segment', async () => {
      mockAuth(adminUser);
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/nba/stats/segment/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
    });
  });
});
