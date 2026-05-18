const { query } = require('../config/database');

/**
 * Get comprehensive dashboard statistics
 * GET /api/v1/dashboard/stats
 */
const getDashboardStats = async (req, res) => {
  try {
    // Get offers statistics
    const offersStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived
      FROM offers
    `);

    // Get offers by type
    const offersByType = await query(`
      SELECT
        offer_type,
        COUNT(*) as count
      FROM offers
      WHERE status = 'active'
      GROUP BY offer_type
      ORDER BY count DESC
    `);

    // Get segments statistics
    const segmentsStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active
      FROM segments
    `);

    // Get customers statistics
    const customersStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN churn_score >= 0.7 THEN 1 END) as high_risk,
        ROUND(AVG(arpu), 2) as avg_arpu,
        ROUND(AVG(tenure_months), 2) as avg_tenure
      FROM customers
    `);

    // Get rules statistics
    const rulesStats = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active
      FROM rules
    `);

    // Get offer history statistics (last 30 days)
    const offerHistoryStats = await query(`
      SELECT
        COUNT(*) as total_shown,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked,
        ROUND(
          COUNT(CASE WHEN status = 'accepted' THEN 1 END)::NUMERIC /
          NULLIF(COUNT(*), 0) * 100,
          2
        ) as conversion_rate
      FROM offer_history
      WHERE shown_at >= NOW() - INTERVAL '30 days'
    `);

    // Get activity by day (last 7 days)
    const activityByDay = await query(`
      SELECT
        DATE(shown_at) as date,
        COUNT(*) as total_shown,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'clicked' THEN 1 END) as clicked
      FROM offer_history
      WHERE shown_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(shown_at)
      ORDER BY date ASC
    `);

    // Get top performing offers (last 30 days)
    const topOffers = await query(`
      SELECT
        o.id,
        o.title,
        o.offer_type,
        COUNT(oh.id) as shown_count,
        COUNT(CASE WHEN oh.status = 'accepted' THEN 1 END) as accepted_count,
        ROUND(
          COUNT(CASE WHEN oh.status = 'accepted' THEN 1 END)::NUMERIC /
          NULLIF(COUNT(oh.id), 0) * 100,
          2
        ) as conversion_rate
      FROM offers o
      LEFT JOIN offer_history oh ON o.id = oh.offer_id
        AND oh.shown_at >= NOW() - INTERVAL '30 days'
      WHERE o.status = 'active'
      GROUP BY o.id, o.title, o.offer_type
      HAVING COUNT(oh.id) > 0
      ORDER BY conversion_rate DESC
      LIMIT 5
    `);

    // Get customer value distribution
    const customerValueDistribution = await query(`
      SELECT
        CASE
          WHEN arpu >= 2000 THEN 'Высокая'
          WHEN arpu >= 1000 THEN 'Средняя'
          ELSE 'Низкая'
        END as value_category,
        COUNT(*) as count
      FROM customers
      WHERE status = 'active'
      GROUP BY
        CASE
          WHEN arpu >= 2000 THEN 'Высокая'
          WHEN arpu >= 1000 THEN 'Средняя'
          ELSE 'Низкая'
        END
      ORDER BY
        CASE
          WHEN CASE
            WHEN arpu >= 2000 THEN 'Высокая'
            WHEN arpu >= 1000 THEN 'Средняя'
            ELSE 'Низкая'
          END = 'Высокая' THEN 1
          WHEN CASE
            WHEN arpu >= 2000 THEN 'Высокая'
            WHEN arpu >= 1000 THEN 'Средняя'
            ELSE 'Низкая'
          END = 'Средняя' THEN 2
          ELSE 3
        END
    `);

    // Get churn risk distribution
    const churnRiskDistribution = await query(`
      SELECT
        CASE
          WHEN churn_score >= 0.7 THEN 'Высокий'
          WHEN churn_score >= 0.4 THEN 'Средний'
          ELSE 'Низкий'
        END as risk_category,
        COUNT(*) as count
      FROM customers
      WHERE status = 'active'
      GROUP BY
        CASE
          WHEN churn_score >= 0.7 THEN 'Высокий'
          WHEN churn_score >= 0.4 THEN 'Средний'
          ELSE 'Низкий'
        END
      ORDER BY
        CASE
          WHEN CASE
            WHEN churn_score >= 0.7 THEN 'Высокий'
            WHEN churn_score >= 0.4 THEN 'Средний'
            ELSE 'Низкий'
          END = 'Высокий' THEN 1
          WHEN CASE
            WHEN churn_score >= 0.7 THEN 'Высокий'
            WHEN churn_score >= 0.4 THEN 'Средний'
            ELSE 'Низкий'
          END = 'Средний' THEN 2
          ELSE 3
        END
    `);

    res.json({
      success: true,
      data: {
        offers: offersStats.rows[0],
        offersByType: offersByType.rows,
        segments: segmentsStats.rows[0],
        customers: customersStats.rows[0],
        rules: rulesStats.rows[0],
        offerHistory: offerHistoryStats.rows[0],
        activityByDay: activityByDay.rows,
        topOffers: topOffers.rows,
        customerValueDistribution: customerValueDistribution.rows,
        churnRiskDistribution: churnRiskDistribution.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats
};
