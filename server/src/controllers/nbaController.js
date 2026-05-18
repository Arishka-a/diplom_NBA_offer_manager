const nbaService = require('../services/nbaService');
const { logAction } = require('../services/logService');

/**
 * Получить рекомендованные офферы для клиента
 * GET /api/v1/nba/recommendations/:customerId
 */
const getRecommendations = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { limit = 3 } = req.query;

    console.log('NBA: Getting recommendations for customer', customerId, 'limit:', limit);

    const recommendations = await nbaService.getNextBestOffers(
      parseInt(customerId),
      parseInt(limit)
    );

    console.log('NBA: Found', recommendations.length, 'recommendations');

    // Логируем получение рекомендаций
    await logAction(
      req.user?.id,
      'READ',
      'nba_recommendations',
      parseInt(customerId),
      req.ip,
      req.headers['user-agent'],
      { recommendations_count: recommendations.length }
    );

    res.json({
      success: true,
      data: {
        customer_id: parseInt(customerId),
        recommendations,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting NBA recommendations:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка при получении рекомендаций',
      error: error.message
    });
  }
};

/**
 * Записать показ оффера клиенту
 * POST /api/v1/nba/record-shown
 */
const recordShown = async (req, res) => {
  try {
    const { customer_id, offer_id, channel = 'web' } = req.body;

    if (!customer_id || !offer_id) {
      return res.status(400).json({
        success: false,
        message: 'Обязательные поля: customer_id, offer_id'
      });
    }

    const historyRecord = await nbaService.recordOfferShown(
      customer_id,
      offer_id,
      channel
    );

    // Логируем показ оффера
    await logAction(
      req.user?.id,
      'CREATE',
      'offer_shown',
      historyRecord.id,
      req.ip,
      req.headers['user-agent'],
      { customer_id, offer_id, channel }
    );

    res.json({
      success: true,
      message: 'Показ оффера записан',
      data: historyRecord
    });
  } catch (error) {
    console.error('Error recording offer shown:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при записи показа оффера',
      error: error.message
    });
  }
};

/**
 * Обновить статус оффера (принят/отклонен)
 * PUT /api/v1/nba/update-status/:historyId
 */
const updateStatus = async (req, res) => {
  try {
    const { historyId } = req.params;
    const { status } = req.body;

    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный статус. Допустимые значения: accepted, rejected'
      });
    }

    const updatedRecord = await nbaService.updateOfferStatus(
      parseInt(historyId),
      status
    );

    // Логируем обновление статуса
    await logAction(
      req.user?.id,
      'UPDATE',
      'offer_history',
      parseInt(historyId),
      req.ip,
      req.headers['user-agent'],
      { status }
    );

    res.json({
      success: true,
      message: `Статус обновлен на "${status}"`,
      data: updatedRecord
    });
  } catch (error) {
    console.error('Error updating offer status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка при обновлении статуса',
      error: error.message
    });
  }
};

/**
 * Получить статистику NBA для клиента
 * GET /api/v1/nba/stats/:customerId
 */
const getCustomerStats = async (req, res) => {
  try {
    const { customerId } = req.params;

    const stats = await nbaService.getCustomerNBAStats(parseInt(customerId));

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting NBA stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики',
      error: error.message
    });
  }
};

/**
 * Получить рекомендованные офферы для сегмента
 * GET /api/v1/nba/recommendations/segment/:segmentId
 */
const getSegmentRecommendations = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { limit = 5 } = req.query;

    console.log('NBA: Getting segment recommendations for segment', segmentId, 'limit:', limit);

    const recommendations = await nbaService.getNextBestOffersForSegment(
      segmentId === 'null' ? null : parseInt(segmentId),
      parseInt(limit)
    );

    console.log('NBA: Found', recommendations.length, 'segment recommendations');

    // Логируем получение рекомендаций для сегмента
    await logAction(
      req.user?.id,
      'READ',
      'nba_segment_recommendations',
      segmentId === 'null' ? 0 : parseInt(segmentId),
      req.ip,
      req.headers['user-agent'],
      { recommendations_count: recommendations.length }
    );

    res.json({
      success: true,
      data: {
        segment_id: segmentId === 'null' ? null : parseInt(segmentId),
        recommendations,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting segment NBA recommendations:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: error.message || 'Ошибка при получении рекомендаций для сегмента',
      error: error.message
    });
  }
};

/**
 * Получить статистику NBA для сегмента
 * GET /api/v1/nba/stats/segment/:segmentId
 */
const getSegmentStats = async (req, res) => {
  try {
    const { segmentId } = req.params;

    console.log('NBA: Getting segment stats for segment', segmentId);

    const stats = await nbaService.getSegmentNBAStats(parseInt(segmentId));

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting segment NBA stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики сегмента',
      error: error.message
    });
  }
};

module.exports = {
  getRecommendations,
  recordShown,
  updateStatus,
  getCustomerStats,
  getSegmentRecommendations,
  getSegmentStats
};
