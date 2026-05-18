const { query } = require('../config/database');
const { buildWhere } = require('../utils/filterBuilder');

const LOG_FILTER_FIELDS = {
  id: 'l.id',
  action: 'l.action',
  entity_type: 'l.entity_type',
  entity_id: 'l.entity_id',
  user_id: 'l.user_id',
  created_at: 'l.created_at',
};

// Получение логов с фильтрацией
const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, date_from, date_to } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let paramIndex = 1;

    let whereClause = 'WHERE 1=1';

    // Date range — keep legacy date_from/date_to that map to created_at
    if (date_from) {
      whereClause += ` AND l.created_at >= $${paramIndex++}`;
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ` AND l.created_at <= $${paramIndex++}`;
      params.push(date_to);
    }

    const generic = buildWhere(LOG_FILTER_FIELDS, req.query, paramIndex - 1);
    if (generic.whereSql) {
      whereClause += ' AND ' + generic.whereSql;
      params.push(...generic.params);
      paramIndex += generic.params.length;
    }

    // Подсчёт
    const countResult = await query(
      `SELECT COUNT(*) FROM logs l ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Получение логов
    const result = await query(
      `SELECT l.*, u.username
       FROM logs l
       LEFT JOIN users u ON l.user_id = u.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('❌ Ошибка получения логов:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Получение истории изменений объекта
const getEntityHistory = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;

    const result = await query(
      `SELECT h.*, u.username as changed_by_username
       FROM history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.entity_type = $1 AND h.entity_id = $2
       ORDER BY h.created_at DESC`,
      [entity_type, entity_id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('❌ Ошибка получения истории:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

module.exports = {
  getLogs,
  getEntityHistory
};
