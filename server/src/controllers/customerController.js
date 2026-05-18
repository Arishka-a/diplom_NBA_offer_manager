const { query, getClient } = require('../config/database');
const { logAction, saveHistory } = require('../services/logService');
const { buildWhere } = require('../utils/filterBuilder');

const CUSTOMER_FILTER_FIELDS = {
  id: 'c.id',
  first_name: 'c.first_name',
  last_name: 'c.last_name',
  email: 'c.email',
  phone: 'c.phone',
  arpu: 'c.arpu',
  tenure_months: 'c.tenure_months',
  churn_score: 'c.churn_score',
  status: 'c.status',
  segment_id: 'c.segment_id',
};

/**
 * Safely build ORDER BY clause using whitelist validation
 */
const buildSafeOrderBy = (sortBy, sortOrder, tableAlias = 'c') => {
  const allowedSortFields = {
    'id': `${tableAlias}.id`,
    'first_name': `${tableAlias}.first_name`,
    'last_name': `${tableAlias}.last_name`,
    'email': `${tableAlias}.email`,
    'arpu': `${tableAlias}.arpu`,
    'tenure_months': `${tableAlias}.tenure_months`,
    'churn_score': `${tableAlias}.churn_score`,
    'status': `${tableAlias}.status`,
    'created_at': `${tableAlias}.created_at`,
    'last_activity_at': `${tableAlias}.last_activity_at`
  };

  const sortField = allowedSortFields[sortBy] || allowedSortFields['id'];
  const sortDir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  return { sortField, sortDir };
};

/**
 * Get customers list with pagination and filtering
 * GET /api/v1/customers
 */
const getCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      min_arpu,
      max_arpu,
      min_churn,
      max_churn,
      sort_by = 'id',
      sort_order = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let paramIndex = 1;

    let whereClause = 'WHERE 1=1';

    if (search) {
      whereClause += ` AND (c.first_name ILIKE $${paramIndex} OR c.last_name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Legacy min_/max_ aliases for ARPU and churn
    if (min_arpu) {
      whereClause += ` AND c.arpu >= $${paramIndex++}`;
      params.push(min_arpu);
    }
    if (max_arpu) {
      whereClause += ` AND c.arpu <= $${paramIndex++}`;
      params.push(max_arpu);
    }
    if (min_churn) {
      whereClause += ` AND c.churn_score >= $${paramIndex++}`;
      params.push(min_churn);
    }
    if (max_churn) {
      whereClause += ` AND c.churn_score <= $${paramIndex++}`;
      params.push(max_churn);
    }

    const generic = buildWhere(CUSTOMER_FILTER_FIELDS, req.query, paramIndex - 1);
    if (generic.whereSql) {
      whereClause += ' AND ' + generic.whereSql;
      params.push(...generic.params);
      paramIndex += generic.params.length;
    }

    const { sortField, sortDir } = buildSafeOrderBy(sort_by, sort_order, 'c');

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM customers c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get customers with segment info
    const customersResult = await query(
      `SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.arpu,
        c.tenure_months,
        c.churn_score,
        c.status,
        c.segment_id,
        s.name as segment_name,
        c.registered_at,
        c.last_activity_at,
        c.created_at,
        c.updated_at
       FROM customers c
       LEFT JOIN segments s ON c.segment_id = s.id
       ${whereClause}
       ORDER BY ${sortField} ${sortDir}
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: customersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка клиентов',
      error: error.message
    });
  }
};

/**
 * Get customer by ID
 * GET /api/v1/customers/:id
 */
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        c.*,
        s.name as segment_name,
        (SELECT COUNT(*) FROM offer_history oh WHERE oh.customer_id = c.id) as total_offers_shown,
        (SELECT COUNT(*) FROM offer_history oh WHERE oh.customer_id = c.id AND oh.status = 'accepted') as total_offers_accepted
       FROM customers c
       LEFT JOIN segments s ON c.segment_id = s.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Клиент не найден'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении данных клиента',
      error: error.message
    });
  }
};

/**
 * Create new customer
 * POST /api/v1/customers
 */
const createCustomer = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      arpu = 0,
      tenure_months = 0,
      churn_score = 0,
      segment_id,
      status = 'active',
      metadata = {}
    } = req.body;

    // Validation
    if (!first_name || !last_name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Обязательные поля: first_name, last_name, email'
      });
    }

    const result = await query(
      `INSERT INTO customers (
        first_name, last_name, email, phone,
        arpu, tenure_months, churn_score,
        segment_id, status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        first_name, last_name, email, phone,
        arpu, tenure_months, churn_score,
        segment_id, status, JSON.stringify(metadata)
      ]
    );

    // Log action
    await logAction(
      req.user?.id,
      'CREATE',
      'customers',
      result.rows[0].id,
      req.ip,
      req.headers['user-agent'],
      { email, segment_id }
    );

    res.status(201).json({
      success: true,
      message: 'Клиент успешно создан',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating customer:', error);

    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        success: false,
        message: 'Клиент с таким email уже существует'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при создании клиента',
      error: error.message
    });
  }
};

/**
 * Update customer
 * PUT /api/v1/customers/:id
 */
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      arpu,
      tenure_months,
      churn_score,
      segment_id,
      status,
      last_activity_at,
      metadata
    } = req.body;

    // Get old data for history
    const oldData = await query('SELECT * FROM customers WHERE id = $1', [id]);
    if (oldData.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Клиент не найден'
      });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      params.push(first_name);
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      params.push(last_name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }
    if (arpu !== undefined) {
      updates.push(`arpu = $${paramIndex++}`);
      params.push(arpu);
    }
    if (tenure_months !== undefined) {
      updates.push(`tenure_months = $${paramIndex++}`);
      params.push(tenure_months);
    }
    if (churn_score !== undefined) {
      updates.push(`churn_score = $${paramIndex++}`);
      params.push(churn_score);
    }
    if (segment_id !== undefined) {
      updates.push(`segment_id = $${paramIndex++}`);
      params.push(segment_id);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (last_activity_at !== undefined) {
      updates.push(`last_activity_at = $${paramIndex++}`);
      params.push(last_activity_at);
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
      `UPDATE customers
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    // Save history
    await saveHistory(
      'customers',
      id,
      req.user?.id,
      oldData.rows[0],
      'Обновление данных клиента'
    );

    // Log action
    await logAction(
      req.user?.id,
      'UPDATE',
      'customers',
      id,
      req.ip,
      req.headers['user-agent'],
      req.body
    );

    res.json({
      success: true,
      message: 'Клиент успешно обновлен',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating customer:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Клиент с таким email уже существует'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении клиента',
      error: error.message
    });
  }
};

/**
 * Delete customer
 * DELETE /api/v1/customers/:id
 */
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM customers WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Клиент не найден'
      });
    }

    // Log action
    await logAction(
      req.user?.id,
      'DELETE',
      'customers',
      id,
      req.ip,
      req.headers['user-agent'],
      { email: result.rows[0].email }
    );

    res.json({
      success: true,
      message: 'Клиент успешно удален'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении клиента',
      error: error.message
    });
  }
};

/**
 * Get customer analytics from view
 * GET /api/v1/customers/analytics
 */
const getCustomerAnalytics = async (req, res) => {
  try {
    const { segment_id, value_category, churn_risk_category } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (segment_id) {
      whereClause += ` AND segment_id = $${paramIndex++}`;
      params.push(segment_id);
    }

    if (value_category) {
      whereClause += ` AND value_category = $${paramIndex++}`;
      params.push(value_category);
    }

    if (churn_risk_category) {
      whereClause += ` AND churn_risk_category = $${paramIndex++}`;
      params.push(churn_risk_category);
    }

    const result = await query(
      `SELECT * FROM v_customer_analytics ${whereClause} ORDER BY id`,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении аналитики клиентов',
      error: error.message
    });
  }
};

/**
 * Get segment distribution
 * GET /api/v1/customers/segment-distribution
 */
const getSegmentDistribution = async (req, res) => {
  try {
    const result = await query('SELECT * FROM v_customer_segment_distribution');

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching segment distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении распределения по сегментам',
      error: error.message
    });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerAnalytics,
  getSegmentDistribution
};
