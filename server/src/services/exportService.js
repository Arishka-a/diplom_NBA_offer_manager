const pool = require('../config/database');
const { generateCSV, generateExcel } = require('../utils/fileParser');

/**
 * Экспорт офферов
 */
const exportOffers = async (format = 'csv') => {
  const query = `
    SELECT
      o.id,
      o.title,
      o.description,
      o.offer_type,
      o.status,
      o.priority,
      o.start_date,
      o.end_date,
      o.created_at,
      u.username as created_by,
      ARRAY_AGG(DISTINCT os.segment_id) FILTER (WHERE os.segment_id IS NOT NULL) as segment_ids
    FROM offers o
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN offer_segments os ON o.id = os.offer_id
    GROUP BY o.id, u.username
    ORDER BY o.id
  `;

  const result = await pool.query(query);

  // Форматирование данных для экспорта
  const data = result.rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description || '',
    offer_type: row.offer_type,
    status: row.status,
    priority: row.priority,
    start_date: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : '',
    end_date: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : '',
    segment_ids: row.segment_ids ? row.segment_ids.filter(id => id !== null).join(',') : '',
    created_by: row.created_by,
    created_at: new Date(row.created_at).toISOString()
  }));

  if (format === 'excel' || format === 'xlsx') {
    return {
      buffer: generateExcel(data, 'Offers'),
      filename: `offers_${Date.now()}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } else {
    return {
      buffer: Buffer.from(generateCSV(data)),
      filename: `offers_${Date.now()}.csv`,
      mimetype: 'text/csv'
    };
  }
};

/**
 * Экспорт сегментов
 */
const exportSegments = async (format = 'csv') => {
  const query = `
    SELECT
      s.id,
      s.name,
      s.description,
      s.criteria,
      s.is_active,
      s.created_at,
      u.username as created_by
    FROM segments s
    LEFT JOIN users u ON s.created_by = u.id
    ORDER BY s.id
  `;

  const result = await pool.query(query);

  // Форматирование данных для экспорта
  const data = result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    criteria: row.criteria ? JSON.stringify(row.criteria) : '',
    is_active: row.is_active,
    created_by: row.created_by,
    created_at: new Date(row.created_at).toISOString()
  }));

  if (format === 'excel' || format === 'xlsx') {
    return {
      buffer: generateExcel(data, 'Segments'),
      filename: `segments_${Date.now()}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } else {
    return {
      buffer: Buffer.from(generateCSV(data)),
      filename: `segments_${Date.now()}.csv`,
      mimetype: 'text/csv'
    };
  }
};

/**
 * Экспорт правил
 */
const exportRules = async (format = 'csv') => {
  const query = `
    SELECT
      r.id,
      r.name,
      r.description,
      r.rule_type,
      r.is_active,
      r.priority,
      r.weight,
      r.rule_definition,
      r.apply_conditions,
      r.target_segments,
      r.target_offer_types,
      r.created_at,
      u.username as created_by
    FROM rules r
    LEFT JOIN users u ON r.created_by = u.id
    ORDER BY r.priority DESC, r.id
  `;

  const result = await pool.query(query);

  // Форматирование данных для экспорта
  const data = result.rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    rule_type: row.rule_type,
    is_active: row.is_active,
    priority: row.priority,
    weight: row.weight,
    rule_definition: JSON.stringify(row.rule_definition),
    apply_conditions: row.apply_conditions ? JSON.stringify(row.apply_conditions) : '',
    target_segments: row.target_segments ? row.target_segments.join(',') : '',
    target_offer_types: row.target_offer_types ? row.target_offer_types.join(',') : '',
    created_by: row.created_by,
    created_at: new Date(row.created_at).toISOString()
  }));

  if (format === 'excel' || format === 'xlsx') {
    return {
      buffer: generateExcel(data, 'Rules'),
      filename: `rules_${Date.now()}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } else {
    return {
      buffer: Buffer.from(generateCSV(data)),
      filename: `rules_${Date.now()}.csv`,
      mimetype: 'text/csv'
    };
  }
};

/**
 * Экспорт логов
 */
const exportLogs = async (format = 'csv', filters = {}) => {
  const { startDate, endDate, action, entityType } = filters;

  let whereClause = '';
  const params = [];
  const conditions = [];

  if (startDate) {
    params.push(startDate);
    conditions.push(`l.created_at >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`l.created_at <= $${params.length}`);
  }

  if (action) {
    params.push(action);
    conditions.push(`l.action = $${params.length}`);
  }

  if (entityType) {
    params.push(entityType);
    conditions.push(`l.entity_type = $${params.length}`);
  }

  if (conditions.length > 0) {
    whereClause = 'WHERE ' + conditions.join(' AND ');
  }

  const query = `
    SELECT
      l.id,
      l.user_id,
      u.username,
      l.action,
      l.entity_type,
      l.entity_id,
      l.created_at,
      l.ip_address
    FROM logs l
    LEFT JOIN users u ON l.user_id = u.id
    ${whereClause}
    ORDER BY l.created_at DESC
    LIMIT 10000
  `;

  const result = await pool.query(query, params);

  // Форматирование данных для экспорта
  const data = result.rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    ip_address: row.ip_address,
    created_at: new Date(row.created_at).toISOString()
  }));

  if (format === 'excel' || format === 'xlsx') {
    return {
      buffer: generateExcel(data, 'Logs'),
      filename: `logs_${Date.now()}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } else {
    return {
      buffer: Buffer.from(generateCSV(data)),
      filename: `logs_${Date.now()}.csv`,
      mimetype: 'text/csv'
    };
  }
};

module.exports = {
  exportOffers,
  exportSegments,
  exportRules,
  exportLogs
};
