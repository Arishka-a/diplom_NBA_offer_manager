// Mock database before requiring the service
jest.mock('../../../src/config/database', () => ({
  query: jest.fn()
}));

const { query } = require('../../../src/config/database');

// Import the service (we'll test the exported functions)
const nbaService = require('../../../src/services/nbaService');

describe('NBA Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNextBestOffers', () => {
    it('should throw error if customer not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(nbaService.getNextBestOffers(999))
        .rejects
        .toThrow('Клиент не найден');
    });

    it('should return empty array if no active offers', async () => {
      // Mock customer query
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@test.com',
          arpu: 1000,
          tenure_months: 12,
          churn_score: 0.3,
          status: 'active',
          segment_id: 1,
          segment_name: 'Premium'
        }]
      });

      // Mock offers query - empty
      query.mockResolvedValueOnce({ rows: [] });

      // Mock history query (not reached but needed for complete mock chain)
      query.mockResolvedValueOnce({ rows: [] });

      const result = await nbaService.getNextBestOffers(1);

      expect(result).toEqual([]);
    });

    it('should return scored offers sorted by nba_score', async () => {
      // Mock customer query
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@test.com',
          arpu: 500,
          tenure_months: 2,
          churn_score: 0.8,
          status: 'active',
          segment_id: 1,
          segment_name: 'At Risk'
        }]
      });

      // Mock offers query
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'Retention Offer',
            description: 'Stay with us',
            offer_type: 'retention',
            priority: 50,
            segments: [{ id: 1, name: 'At Risk' }]
          },
          {
            id: 2,
            title: 'Discount Offer',
            description: 'Save money',
            offer_type: 'discount',
            priority: 40,
            segments: []
          }
        ]
      });

      // Mock history query - no excluded offers
      query.mockResolvedValueOnce({ rows: [] });

      const result = await nbaService.getNextBestOffers(1, 3);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('nba_score');
      expect(result[0]).toHaveProperty('recommendation_reasons');
      expect(result[0]).toHaveProperty('customer_profile');

      // Verify offers are sorted by score descending
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].nba_score).toBeGreaterThanOrEqual(result[i + 1].nba_score);
      }
    });

    it('should exclude rejected offers from recommendations', async () => {
      // Mock customer query
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@test.com',
          arpu: 1000,
          tenure_months: 12,
          churn_score: 0.3,
          status: 'active',
          segment_id: 1,
          segment_name: 'Premium'
        }]
      });

      // Mock offers query
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Offer 1', offer_type: 'bonus', priority: 50, segments: [] },
          { id: 2, title: 'Offer 2', offer_type: 'bonus', priority: 40, segments: [] }
        ]
      });

      // Mock history query - offer 1 was rejected
      query.mockResolvedValueOnce({ rows: [{ offer_id: 1 }] });

      const result = await nbaService.getNextBestOffers(1);

      expect(result.every(o => o.id !== 1)).toBe(true);
    });
  });

  describe('getNextBestOffersForSegment', () => {
    it('should throw error if segment not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(nbaService.getNextBestOffersForSegment(999))
        .rejects
        .toThrow('Сегмент не найден');
    });

    it('should return offers for all customers when segmentId is null', async () => {
      // Mock all customers stats query
      query.mockResolvedValueOnce({
        rows: [{
          customer_count: 100,
          avg_arpu: 1200,
          avg_tenure_months: 18,
          avg_churn_score: 0.4
        }]
      });

      // Mock offers query
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'General Offer',
            description: 'For everyone',
            offer_type: 'bonus',
            priority: 60,
            segments: []
          }
        ]
      });

      const result = await nbaService.getNextBestOffersForSegment(null, 5);

      expect(result.length).toBe(1);
      expect(result[0].segment_profile.segment_name).toBe('Все клиенты');
    });

    it('should calculate correct segment profile stats', async () => {
      // Mock segment query
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'VIP',
          description: 'High value customers',
          customer_count: 50,
          avg_arpu: 2000,
          avg_tenure_months: 24,
          avg_churn_score: 0.2
        }]
      });

      // Mock offers query
      query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            title: 'VIP Upgrade',
            offer_type: 'upgrade',
            priority: 70,
            segments: [{ id: 1, name: 'VIP' }]
          }
        ]
      });

      const result = await nbaService.getNextBestOffersForSegment(1);

      expect(result[0].segment_profile).toEqual({
        segment_name: 'VIP',
        avg_arpu: 2000,
        avg_tenure_months: 24,
        avg_churn_risk: 'Низкий риск',
        customer_count: 50
      });
    });
  });

  describe('recordOfferShown', () => {
    it('should insert offer history record', async () => {
      const mockRecord = {
        id: 1,
        customer_id: 1,
        offer_id: 1,
        status: 'shown',
        channel: 'web'
      };

      query.mockResolvedValueOnce({ rows: [mockRecord] });

      const result = await nbaService.recordOfferShown(1, 1, 'web');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO offer_history'),
        [1, 1, 'web']
      );
      expect(result).toEqual(mockRecord);
    });

    it('should use default channel if not provided', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await nbaService.recordOfferShown(1, 1);

      expect(query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1, 'web']
      );
    });
  });

  describe('updateOfferStatus', () => {
    it('should throw error for invalid status', async () => {
      await expect(nbaService.updateOfferStatus(1, 'invalid'))
        .rejects
        .toThrow('Недопустимый статус');
    });

    it('should throw error if history record not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(nbaService.updateOfferStatus(999, 'accepted'))
        .rejects
        .toThrow('Запись в истории не найдена');
    });

    it('should update status to accepted', async () => {
      const mockRecord = { id: 1, status: 'accepted' };
      query.mockResolvedValueOnce({ rows: [mockRecord] });

      const result = await nbaService.updateOfferStatus(1, 'accepted');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('accepted_at'),
        ['accepted', 1]
      );
      expect(result).toEqual(mockRecord);
    });

    it('should update status to rejected', async () => {
      const mockRecord = { id: 1, status: 'rejected' };
      query.mockResolvedValueOnce({ rows: [mockRecord] });

      const result = await nbaService.updateOfferStatus(1, 'rejected');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('rejected_at'),
        ['rejected', 1]
      );
      expect(result).toEqual(mockRecord);
    });
  });

  describe('getCustomerNBAStats', () => {
    it('should return customer statistics', async () => {
      const mockStats = {
        total_offers_shown: 10,
        accepted_count: 3,
        rejected_count: 5,
        pending_count: 2,
        conversion_rate: 37.5
      };

      query.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await nbaService.getCustomerNBAStats(1);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('offer_history'),
        [1]
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('getSegmentNBAStats', () => {
    it('should throw error if segment not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(nbaService.getSegmentNBAStats(999))
        .rejects
        .toThrow('Сегмент не найден');
    });

    it('should return complete segment statistics', async () => {
      // Mock segment query
      query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Premium', description: 'Premium customers' }]
      });

      // Mock stats query
      query.mockResolvedValueOnce({
        rows: [{
          customers_engaged: 30,
          total_offers_shown: 100,
          accepted_count: 40,
          rejected_count: 50,
          pending_count: 10,
          conversion_rate: 44.44,
          unique_offers_shown: 5
        }]
      });

      // Mock customer count query
      query.mockResolvedValueOnce({
        rows: [{ total_customers: 50 }]
      });

      // Mock top offers query
      query.mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Top Offer', offer_type: 'bonus', shown_count: 30, accepted_count: 15, conversion_rate: 50.00 }
        ]
      });

      const result = await nbaService.getSegmentNBAStats(1);

      expect(result.segment).toEqual({
        id: 1,
        name: 'Premium',
        description: 'Premium customers',
        total_customers: 50
      });
      expect(result.overall_stats.engagement_rate).toBe(60);
      expect(result.top_offers).toHaveLength(1);
    });
  });
});

// Test pure helper functions by extracting their logic
describe('NBA Helper Functions Logic', () => {
  describe('Churn Risk Label', () => {
    // These test the logic that would be in getChurnRiskLabel
    it('should return "Высокий риск" for churn score >= 0.7', () => {
      const getChurnRiskLabel = (score) => {
        if (score >= 0.7) return 'Высокий риск';
        if (score >= 0.4) return 'Средний риск';
        return 'Низкий риск';
      };

      expect(getChurnRiskLabel(0.7)).toBe('Высокий риск');
      expect(getChurnRiskLabel(0.9)).toBe('Высокий риск');
      expect(getChurnRiskLabel(1.0)).toBe('Высокий риск');
    });

    it('should return "Средний риск" for churn score >= 0.4 and < 0.7', () => {
      const getChurnRiskLabel = (score) => {
        if (score >= 0.7) return 'Высокий риск';
        if (score >= 0.4) return 'Средний риск';
        return 'Низкий риск';
      };

      expect(getChurnRiskLabel(0.4)).toBe('Средний риск');
      expect(getChurnRiskLabel(0.5)).toBe('Средний риск');
      expect(getChurnRiskLabel(0.69)).toBe('Средний риск');
    });

    it('should return "Низкий риск" for churn score < 0.4', () => {
      const getChurnRiskLabel = (score) => {
        if (score >= 0.7) return 'Высокий риск';
        if (score >= 0.4) return 'Средний риск';
        return 'Низкий риск';
      };

      expect(getChurnRiskLabel(0)).toBe('Низкий риск');
      expect(getChurnRiskLabel(0.2)).toBe('Низкий риск');
      expect(getChurnRiskLabel(0.39)).toBe('Низкий риск');
    });
  });

  describe('Offer Type Bonus Calculation', () => {
    // Test the scoring logic for different offer types
    const calculateOfferTypeBonus = (offerType, customer) => {
      const { churn_score, arpu, tenure_months } = customer;

      switch (offerType) {
        case 'retention':
          if (churn_score >= 0.7) return { score: 30, reason: 'Критически важно для удержания' };
          if (churn_score >= 0.4) return { score: 15, reason: 'Помогает снизить риск оттока' };
          return { score: 0 };

        case 'upgrade':
          if (arpu >= 2000) return { score: 25, reason: 'Идеально подходит для вашего тарифа' };
          if (arpu >= 1000 && tenure_months >= 12) return { score: 15, reason: 'Отличная возможность для улучшения тарифа' };
          return { score: 5 };

        case 'discount':
          if (arpu < 1000) return { score: 20, reason: 'Максимальная экономия для вашего тарифа' };
          if (churn_score >= 0.5) return { score: 15, reason: 'Специальная скидка' };
          return { score: 5 };

        case 'bonus':
          if (tenure_months <= 3) return { score: 20, reason: 'Приветственный бонус для новых клиентов' };
          if (tenure_months >= 24) return { score: 15, reason: 'Бонус за лояльность' };
          return { score: 10 };

        case 'recommendation':
          if (tenure_months >= 6 && churn_score < 0.5) return { score: 15, reason: 'Дополнительная услуга для активных клиентов' };
          return { score: 5 };

        default:
          return { score: 0 };
      }
    };

    it('should give high score for retention offers to high churn customers', () => {
      const customer = { churn_score: 0.8, arpu: 1000, tenure_months: 12 };
      const result = calculateOfferTypeBonus('retention', customer);
      expect(result.score).toBe(30);
    });

    it('should give medium score for retention offers to medium churn customers', () => {
      const customer = { churn_score: 0.5, arpu: 1000, tenure_months: 12 };
      const result = calculateOfferTypeBonus('retention', customer);
      expect(result.score).toBe(15);
    });

    it('should give high score for upgrade offers to high ARPU customers', () => {
      const customer = { churn_score: 0.2, arpu: 2500, tenure_months: 24 };
      const result = calculateOfferTypeBonus('upgrade', customer);
      expect(result.score).toBe(25);
    });

    it('should give high score for discount offers to low ARPU customers', () => {
      const customer = { churn_score: 0.2, arpu: 500, tenure_months: 12 };
      const result = calculateOfferTypeBonus('discount', customer);
      expect(result.score).toBe(20);
    });

    it('should give high score for bonus offers to new customers', () => {
      const customer = { churn_score: 0.2, arpu: 1000, tenure_months: 2 };
      const result = calculateOfferTypeBonus('bonus', customer);
      expect(result.score).toBe(20);
    });

    it('should give loyalty score for bonus offers to long-term customers', () => {
      const customer = { churn_score: 0.2, arpu: 1000, tenure_months: 36 };
      const result = calculateOfferTypeBonus('bonus', customer);
      expect(result.score).toBe(15);
    });

    it('should return 0 score for unknown offer types', () => {
      const customer = { churn_score: 0.5, arpu: 1000, tenure_months: 12 };
      const result = calculateOfferTypeBonus('unknown', customer);
      expect(result.score).toBe(0);
    });
  });
});
