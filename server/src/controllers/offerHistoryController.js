const { query, getClient } = require('../config/database');
const { logAction } = require('../services/logService');

/**
 * Safely build ORDER BY clause using whitelist validation
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort direction (ASC/DESC)
 * @returns {object} - Object with safe sortField and sortDir
 */
const buildSafeOrderBy = (sortBy, sortOrder, tableAlias = 'oh') => {
  const allowedSortFields = {
    'shown_at': `${tableAlias}.shown_at`,
    'response_at': `${tableAlias}.response_at`,
    'status': `${tableAlias}.status`,
    'channel': `${tableAlias}.channel`
  };

  const sortField = allowedSortFields[sortBy] || allowedSortFields['shown_at'];
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return { sortField, sortDir };
};

/**
 * Get offer history with pagination and filtering
 * GET /api/v1/offer-history
 */
const getOfferHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      customer_id,
      offer_id,
      status,
      channel,
      date_from,
      date_to,
      sort_by = 'shown_at',
      sort_order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let paramIndex = 1;

    let whereClause = 'WHERE 1=1';

    if (customer_id) {
      whereClause += ` AND oh.customer_id = $${paramIndex++}`;
      params.push(customer_id);
    }

    if (offer_id) {
      whereClause += ` AND oh.offer_id = $${paramIndex++}`;
      params.push(offer_id);
    }

    if (status) {
      whereClause += ` AND oh.status = $${paramIndex++}`;
      params.push(status);
    }

    if (channel) {
      whereClause += ` AND oh.channel = $${paramIndex++}`;
      params.push(channel);
    }

    if (date_from) {
      whereClause += ` AND oh.shown_at >= $${paramIndex++}`;
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ` AND oh.shown_at <= $${paramIndex++}`;
      params.push(date_to);
    }

    const { sortField, sortDir } = buildSafeOrderBy(sort_by, sort_order, 'oh');

    // Count total records
    const countResult = await query(
      `SELECT COUNT(*) FROM offer_history oh ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get offer history with offer details
    const historyResult = await query(
      `SELECT
        oh.id,
        oh.customer_id,
        oh.offer_id,
        o.title AS offer_title,
        o.offer_type,
        o.description AS offer_description,
        oh.shown_at,
        oh.status,
        oh.channel,
        oh.response_at,
        oh.metadata,
        oh.created_at
       FROM offer_history oh
       JOIN offers o ON oh.offer_id = o.id
       ${whereClause}
       ORDER BY ${sortField} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: historyResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching offer history:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении истории офферов',
      error: error.message
    });
  }
};

/**
 * Get offer history by customer
 * GET /api/v1/offer-history/customer/:customerId
 */
const getCustomerOfferHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { limit = 50 } = req.query;

    const result = await query(
      `SELECT * FROM v_customer_offer_history
       WHERE customer_id = $1
       ORDER BY shown_at DESC
       LIMIT $2`,
      [customerId, limit]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching customer offer history:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении истории офферов клиента',
      error: error.message
    });
  }
};

/**
 * Get offer conversion statistics
 * GET /api/v1/offer-history/conversion-stats
 */
const getConversionStats = async (req, res) => {
  try {
    const { offer_id, date_from, date_to, channel } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (offer_id) {
      whereClause += ` AND offer_id = $${paramIndex++}`;
      params.push(offer_id);
    }

    if (date_from) {
      whereClause += ` AND date_shown >= $${paramIndex++}`;
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ` AND date_shown <= $${paramIndex++}`;
      params.push(date_to);
    }

    if (channel) {
      whereClause += ` AND channel = $${paramIndex++}`;
      params.push(channel);
    }

    const result = await query(
      `SELECT * FROM v_offer_conversion_stats
       ${whereClause}
       ORDER BY total_shown DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching conversion stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики конверсии',
      error: error.message
    });
  }
};

/**
 * Create offer history record
 * POST /api/v1/offer-history
 */
const createOfferHistory = async (req, res) => {
  try {
    const { customer_id, offer_id, status, channel, metadata } = req.body;

    // Validation
    if (!customer_id || !offer_id) {
      return res.status(400).json({
        success: false,
        message: 'customer_id и offer_id обязательны'
      });
    }

    const result = await query(
      `INSERT INTO offer_history (customer_id, offer_id, status, channel, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [customer_id, offer_id, status || 'shown', channel, metadata ? JSON.stringify(metadata) : null]
    );

    // Log action
    await logAction(
      req.user?.id,
      'CREATE',
      'offer_history',
      result.rows[0].id,
      req.ip,
      req.headers['user-agent'],
      { customer_id, offer_id, status, channel }
    );

    res.status(201).json({
      success: true,
      message: 'Запись истории оффера создана',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating offer history:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании записи истории оффера',
      error: error.message
    });
  }
};

/**
 * Update offer history record (update status/response)
 * PUT /api/v1/offer-history/:id
 */
const updateOfferHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response_at, metadata } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (response_at !== undefined) {
      updates.push(`response_at = $${paramIndex++}`);
      params.push(response_at);
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      params.push(JSON.stringify(metadata));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Нет данных для обновления'
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE offer_history
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Запись истории не найдена'
      });
    }

    // Log action
    await logAction(
      req.user?.id,
      'UPDATE',
      'offer_history',
      id,
      req.ip,
      req.headers['user-agent'],
      { status, response_at, metadata }
    );

    res.json({
      success: true,
      message: 'Запись истории оффера обновлена',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating offer history:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении записи истории оффера',
      error: error.message
    });
  }
};

/**
 * Get offer performance summary
 * GET /api/v1/offer-history/performance/:offerId
 */
const getOfferPerformance = async (req, res) => {
  try {
    const { offerId } = req.params;

    const result = await query(
      `SELECT
        o.id,
        o.title,
        o.offer_type,
        COUNT(oh.id) AS total_displays,
        COUNT(CASE WHEN oh.status = 'shown' THEN 1 END) AS shown_count,
        COUNT(CASE WHEN oh.status = 'clicked' THEN 1 END) AS clicked_count,
        COUNT(CASE WHEN oh.status = 'accepted' THEN 1 END) AS accepted_count,
        COUNT(CASE WHEN oh.status = 'rejected' THEN 1 END) AS rejected_count,
        ROUND(
          COUNT(CASE WHEN oh.status = 'clicked' THEN 1 END)::NUMERIC /
          NULLIF(COUNT(oh.id), 0) * 100,
          2
        ) AS click_rate,
        ROUND(
          COUNT(CASE WHEN oh.status = 'accepted' THEN 1 END)::NUMERIC /
          NULLIF(COUNT(oh.id), 0) * 100,
          2
        ) AS acceptance_rate,
        json_agg(
          DISTINCT jsonb_build_object(
            'channel', oh.channel,
            'count', (SELECT COUNT(*) FROM offer_history WHERE offer_id = o.id AND channel = oh.channel)
          )
        ) FILTER (WHERE oh.channel IS NOT NULL) AS channels
      FROM offers o
      LEFT JOIN offer_history oh ON o.id = oh.offer_id
      WHERE o.id = $1
      GROUP BY o.id, o.title, o.offer_type`,
      [offerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Оффер не найден'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching offer performance:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики оффера',
      error: error.message
    });
  }
};

module.exports = {
  getOfferHistory,
  getCustomerOfferHistory,
  getConversionStats,
  createOfferHistory,
  updateOfferHistory,
  getOfferPerformance
};
