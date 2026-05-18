const { pool } = require('../config/database');

/**
 * Получить общую статистику для дашборда
 */
const getDashboardStats = async () => {
  // Общее количество офферов по статусам
  const offersQuery = `
    SELECT
      COUNT(*) as total_offers,
      COUNT(*) FILTER (WHERE status = 'active') as active_offers,
      COUNT(*) FILTER (WHERE status = 'draft') as draft_offers,
      COUNT(*) FILTER (WHERE status = 'inactive') as inactive_offers
    FROM offers
  `;

  // Общее количество сегментов
  const segmentsQuery = `
    SELECT
      COUNT(*) as total_segments,
      COUNT(*) FILTER (WHERE is_active = true) as active_segments
    FROM segments
  `;

  // Общее количество клиентов
  const customersQuery = `
    SELECT COUNT(*) as total_customers FROM customers
  `;

  // Статистика показов и принятий офферов
  const interactionsQuery = `
    SELECT
      COUNT(*) FILTER (WHERE action = 'view') as total_views,
      COUNT(*) FILTER (WHERE action = 'accept') as total_accepts,
      COUNT(*) FILTER (WHERE action = 'reject') as total_rejects,
      ROUND(
        COUNT(*) FILTER (WHERE action = 'accept')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE action = 'view'), 0) * 100,
        2
      ) as conversion_rate
    FROM customer_offer_interactions
  `;

  // Активность за последние 30 дней
  const recentActivityQuery = `
    SELECT COUNT(*) as recent_interactions
    FROM customer_offer_interactions
    WHERE created_at >= NOW() - INTERVAL '30 days'
  `;

  const [offers, segments, customers, interactions, recentActivity] = await Promise.all([
    pool.query(offersQuery),
    pool.query(segmentsQuery),
    pool.query(customersQuery),
    pool.query(interactionsQuery),
    pool.query(recentActivityQuery)
  ]);

  return {
    offers: offers.rows[0],
    segments: segments.rows[0],
    customers: customers.rows[0],
    interactions: interactions.rows[0],
    recentActivity: recentActivity.rows[0]
  };
};

/**
 * Получить статистику по офферам
 */
const getOfferPerformanceReport = async (startDate, endDate) => {
  const params = [];
  let dateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `AND coi.created_at BETWEEN $1 AND $2`;
  }

  const query = `
    SELECT
      o.id,
      o.title,
      o.offer_type,
      o.status,
      o.priority,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'view') as views,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'accept') as accepts,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'reject') as rejects,
      ROUND(
        COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'accept')::numeric /
        NULLIF(COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'view'), 0) * 100,
        2
      ) as conversion_rate,
      COUNT(DISTINCT os.segment_id) as segment_count
    FROM offers o
    LEFT JOIN customer_offer_interactions coi ON o.id = coi.offer_id ${dateFilter}
    LEFT JOIN offer_segments os ON o.id = os.offer_id
    GROUP BY o.id, o.title, o.offer_type, o.status, o.priority
    ORDER BY conversion_rate DESC NULLS LAST, views DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Получить статистику по типам офферов
 */
const getOfferTypeReport = async (startDate, endDate) => {
  const params = [];
  let dateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `AND coi.created_at BETWEEN $1 AND $2`;
  }

  const query = `
    SELECT
      o.offer_type,
      COUNT(DISTINCT o.id) as offer_count,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'view') as total_views,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'accept') as total_accepts,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'reject') as total_rejects,
      ROUND(
        COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'accept')::numeric /
        NULLIF(COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'view'), 0) * 100,
        2
      ) as conversion_rate
    FROM offers o
    LEFT JOIN customer_offer_interactions coi ON o.id = coi.offer_id ${dateFilter}
    GROUP BY o.offer_type
    ORDER BY conversion_rate DESC NULLS LAST
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Получить статистику по сегментам
 */
const getSegmentPerformanceReport = async (startDate, endDate) => {
  const params = [];
  let dateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `AND coi.created_at BETWEEN $1 AND $2`;
  }

  const query = `
    SELECT
      s.id,
      s.name,
      s.is_active,
      COUNT(DISTINCT c.id) as customer_count,
      COUNT(DISTINCT os.offer_id) as offer_count,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'view') as total_views,
      COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'accept') as total_accepts,
      ROUND(
        COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'accept')::numeric /
        NULLIF(COUNT(DISTINCT coi.id) FILTER (WHERE coi.action = 'view'), 0) * 100,
        2
      ) as conversion_rate,
      ROUND(AVG(c.arpu), 2) as avg_arpu,
      ROUND(AVG(c.churn_score), 2) as avg_churn_score
    FROM segments s
    LEFT JOIN customers c ON c.segment_id = s.id
    LEFT JOIN offer_segments os ON s.id = os.segment_id
    LEFT JOIN customer_offer_interactions coi ON c.id = coi.customer_id ${dateFilter}
    GROUP BY s.id, s.name, s.is_active
    ORDER BY customer_count DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Получить временной ряд взаимодействий с офферами
 */
const getInteractionsTrendReport = async (startDate, endDate, interval = 'day') => {
  const params = [];
  let dateFilter = '';
  let truncExpression = 'day';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `WHERE coi.created_at BETWEEN $1 AND $2`;
  }

  // Определяем интервал группировки
  if (interval === 'month') {
    truncExpression = 'month';
  } else if (interval === 'week') {
    truncExpression = 'week';
  }

  const query = `
    SELECT
      DATE_TRUNC('${truncExpression}', coi.created_at) as period,
      COUNT(*) FILTER (WHERE coi.action = 'view') as views,
      COUNT(*) FILTER (WHERE coi.action = 'accept') as accepts,
      COUNT(*) FILTER (WHERE coi.action = 'reject') as rejects,
      ROUND(
        COUNT(*) FILTER (WHERE coi.action = 'accept')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE coi.action = 'view'), 0) * 100,
        2
      ) as conversion_rate
    FROM customer_offer_interactions coi
    ${dateFilter}
    GROUP BY period
    ORDER BY period
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Получить топ-N офферов по конверсии
 */
const getTopOffersByConversion = async (limit = 10, startDate, endDate) => {
  const params = [limit];
  let dateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `AND coi.created_at BETWEEN $2 AND $3`;
  }

  const query = `
    SELECT
      o.id,
      o.title,
      o.offer_type,
      COUNT(*) FILTER (WHERE coi.action = 'view') as views,
      COUNT(*) FILTER (WHERE coi.action = 'accept') as accepts,
      ROUND(
        COUNT(*) FILTER (WHERE coi.action = 'accept')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE coi.action = 'view'), 0) * 100,
        2
      ) as conversion_rate
    FROM offers o
    LEFT JOIN customer_offer_interactions coi ON o.id = coi.offer_id ${dateFilter}
    WHERE o.status = 'active'
    GROUP BY o.id, o.title, o.offer_type
    HAVING COUNT(*) FILTER (WHERE coi.action = 'view') > 0
    ORDER BY conversion_rate DESC NULLS LAST
    LIMIT $1
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Получить топ-N офферов по количеству просмотров
 */
const getTopOffersByViews = async (limit = 10, startDate, endDate) => {
  const params = [limit];
  let dateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `AND coi.created_at BETWEEN $2 AND $3`;
  }

  const query = `
    SELECT
      o.id,
      o.title,
      o.offer_type,
      COUNT(*) FILTER (WHERE coi.action = 'view') as views,
      COUNT(*) FILTER (WHERE coi.action = 'accept') as accepts,
      ROUND(
        COUNT(*) FILTER (WHERE coi.action = 'accept')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE coi.action = 'view'), 0) * 100,
        2
      ) as conversion_rate
    FROM offers o
    LEFT JOIN customer_offer_interactions coi ON o.id = coi.offer_id ${dateFilter}
    WHERE o.status = 'active'
    GROUP BY o.id, o.title, o.offer_type
    ORDER BY views DESC
    LIMIT $1
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Получить статистику активности пользователей системы
 */
const getUserActivityReport = async (startDate, endDate) => {
  const params = [];
  let dateFilter = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `WHERE l.created_at BETWEEN $1 AND $2`;
  }

  const query = `
    SELECT
      u.id,
      u.username,
      u.role,
      COUNT(DISTINCT l.id) as total_actions,
      COUNT(DISTINCT l.id) FILTER (WHERE l.action = 'CREATE') as creates,
      COUNT(DISTINCT l.id) FILTER (WHERE l.action = 'UPDATE') as updates,
      COUNT(DISTINCT l.id) FILTER (WHERE l.action = 'DELETE') as deletes,
      COUNT(DISTINCT l.id) FILTER (WHERE l.action = 'IMPORT') as imports,
      COUNT(DISTINCT l.id) FILTER (WHERE l.action = 'EXPORT') as exports,
      MAX(l.created_at) as last_activity
    FROM users u
    LEFT JOIN logs l ON u.id = l.user_id ${dateFilter.replace('WHERE', 'AND')}
    ${dateFilter}
    GROUP BY u.id, u.username, u.role
    ORDER BY total_actions DESC
  `;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Получить статистику по клиентам
 */
const getCustomerStatsReport = async () => {
  const query = `
    SELECT
      COUNT(*) as total_customers,
      COUNT(*) FILTER (WHERE churn_score < 30) as low_churn,
      COUNT(*) FILTER (WHERE churn_score BETWEEN 30 AND 70) as medium_churn,
      COUNT(*) FILTER (WHERE churn_score > 70) as high_churn,
      ROUND(AVG(arpu), 2) as avg_arpu,
      ROUND(AVG(tenure_months), 2) as avg_tenure,
      ROUND(AVG(churn_score), 2) as avg_churn_score,
      COUNT(DISTINCT segment_id) as segments_with_customers
    FROM customers
  `;

  const result = await pool.query(query);
  return result.rows[0];
};

/**
 * Получить распределение клиентов по сегментам
 */
const getCustomerSegmentDistribution = async () => {
  const query = `
    SELECT
      COALESCE(s.name, 'Без сегмента') as segment_name,
      COUNT(c.id) as customer_count,
      ROUND(AVG(c.arpu), 2) as avg_arpu,
      ROUND(AVG(c.churn_score), 2) as avg_churn_score
    FROM customers c
    LEFT JOIN segments s ON c.segment_id = s.id
    GROUP BY s.id, s.name
    ORDER BY customer_count DESC
  `;

  const result = await pool.query(query);
  return result.rows;
};

/**
 * Получить статистику по правилам NBA
 */
const getRulesReport = async () => {
  const query = `
    SELECT
      r.id,
      r.name,
      r.rule_type,
      r.is_active,
      r.priority,
      r.weight,
      r.target_segments,
      r.target_offer_types,
      r.created_at
    FROM rules r
    ORDER BY r.priority DESC, r.created_at DESC
  `;

  const result = await pool.query(query);
  return result.rows;
};

module.exports = {
  getDashboardStats,
  getOfferPerformanceReport,
  getOfferTypeReport,
  getSegmentPerformanceReport,
  getInteractionsTrendReport,
  getTopOffersByConversion,
  getTopOffersByViews,
  getUserActivityReport,
  getCustomerStatsReport,
  getCustomerSegmentDistribution,
  getRulesReport
};
