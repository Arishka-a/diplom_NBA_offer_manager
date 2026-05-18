const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { logAction } = require('../services/logService');
const { buildWhere } = require('../utils/filterBuilder');

const USER_FILTER_FIELDS = {
  id: 'u.id',
  username: 'u.username',
  email: 'u.email',
  is_active: 'u.is_active',
  created_at: 'u.created_at',
  last_login: 'u.last_login',
  role: 'r.name',
};

/**
 * Получить список всех пользователей (только для администратора)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const generic = buildWhere(USER_FILTER_FIELDS, req.query, paramIndex - 1);
    if (generic.whereSql) {
      conditions.push(generic.whereSql);
      params.push(...generic.params);
      paramIndex += generic.params.length;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Подсчет общего количества
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Получение пользователей
    params.push(limit, offset);
    const result = await query(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.is_active,
        u.created_at,
        u.last_login,
        r.id as role_id,
        r.name as role,
        r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
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
    console.error('❌ Ошибка получения пользователей:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка пользователей'
    });
  }
};

/**
 * Получить пользователя по ID
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.is_active,
        u.created_at,
        u.last_login,
        r.id as role_id,
        r.name as role,
        r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('❌ Ошибка получения пользователя:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении пользователя'
    });
  }
};

/**
 * Создать нового пользователя (только администратор)
 */
const createUser = async (req, res) => {
  try {
    const { username, email, password, role_id } = req.body;

    // Проверка существующего пользователя
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким логином или email уже существует'
      });
    }

    // Проверка существования роли
    const roleCheck = await query('SELECT id FROM roles WHERE id = $1', [role_id]);
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Указанная роль не существует'
      });
    }

    // Хэширование пароля
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Создание пользователя
    const result = await query(
      `INSERT INTO users (username, email, password_hash, role_id, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, username, email, is_active, created_at`,
      [username, email, passwordHash, role_id]
    );

    const user = result.rows[0];

    // Получить имя роли
    const roleResult = await query('SELECT name FROM roles WHERE id = $1', [role_id]);
    user.role = roleResult.rows[0].name;

    // Логирование
    await logAction(
      req.user.id,
      'CREATE',
      'User',
      user.id,
      { username, email, role: user.role, created_by_admin: true },
      req
    );

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно создан',
      data: user
    });
  } catch (err) {
    console.error('❌ Ошибка создания пользователя:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании пользователя'
    });
  }
};

/**
 * Обновить данные пользователя
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role_id, is_active } = req.body;

    // Проверка существования пользователя
    const userCheck = await query('SELECT id, username, email, role_id, is_active FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    const oldUser = userCheck.rows[0];

    // Запрет деактивации собственного аккаунта
    if (parseInt(id) === req.user.id && is_active === false) {
      return res.status(403).json({
        success: false,
        message: 'Вы не можете деактивировать свой собственный аккаунт'
      });
    }

    // Запрет изменения собственной роли
    if (parseInt(id) === req.user.id && role_id && role_id !== oldUser.role_id) {
      return res.status(403).json({
        success: false,
        message: 'Вы не можете изменить свою собственную роль'
      });
    }

    // Проверка уникальности username и email (если изменились)
    if (username !== oldUser.username || email !== oldUser.email) {
      const duplicateCheck = await query(
        'SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3',
        [username, email, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Пользователь с таким логином или email уже существует'
        });
      }
    }

    // Проверка существования роли
    if (role_id) {
      const roleCheck = await query('SELECT id FROM roles WHERE id = $1', [role_id]);
      if (roleCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Указанная роль не существует'
        });
      }
    }

    // Подготовка SQL для обновления
    let updateQuery = 'UPDATE users SET username = $1, email = $2';
    let params = [username, email];
    let paramIndex = 3;

    // Если передана роль
    if (role_id) {
      updateQuery += `, role_id = $${paramIndex}`;
      params.push(role_id);
      paramIndex++;
    }

    // Если передан статус
    if (typeof is_active === 'boolean') {
      updateQuery += `, is_active = $${paramIndex}`;
      params.push(is_active);
      paramIndex++;

      // Если деактивируем - устанавливаем дату деактивации
      if (!is_active && oldUser.is_active) {
        updateQuery += `, deactivated_at = CURRENT_TIMESTAMP`;
      }
      // Если активируем - сбрасываем дату деактивации
      if (is_active && !oldUser.is_active) {
        updateQuery += `, deactivated_at = NULL`;
      }
    }

    // Если передан новый пароль, хэшируем его
    if (password) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      updateQuery += `, password_hash = $${paramIndex}`;
      params.push(passwordHash);
      paramIndex++;
    }

    updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex} RETURNING id, username, email, is_active, role_id, created_at`;
    params.push(id);

    const result = await query(updateQuery, params);
    const updatedUser = result.rows[0];

    // Логирование
    await logAction(
      req.user.id,
      'UPDATE',
      'User',
      id,
      {
        old: { username: oldUser.username, email: oldUser.email, role_id: oldUser.role_id, is_active: oldUser.is_active },
        new: { username, email, role_id: role_id || oldUser.role_id, is_active: is_active !== undefined ? is_active : oldUser.is_active },
        password_changed: !!password
      },
      req
    );

    res.json({
      success: true,
      message: 'Данные пользователя обновлены',
      data: updatedUser
    });
  } catch (err) {
    console.error('❌ Ошибка обновления пользователя:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении пользователя'
    });
  }
};

/**
 * Изменить роль пользователя
 */
const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;

    // Запрет изменения собственной роли
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Вы не можете изменить свою собственную роль'
      });
    }

    // Проверка существования пользователя
    const userCheck = await query(
      'SELECT id, username, role_id FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    const oldRoleId = userCheck.rows[0].role_id;

    // Проверка существования роли
    const roleCheck = await query('SELECT id, name FROM roles WHERE id = $1', [role_id]);
    if (roleCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Указанная роль не существует'
      });
    }

    const newRole = roleCheck.rows[0];

    // Обновление роли
    await query(
      'UPDATE users SET role_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [role_id, id]
    );

    // Получить старую роль для логирования
    const oldRoleResult = await query('SELECT name FROM roles WHERE id = $1', [oldRoleId]);
    const oldRole = oldRoleResult.rows[0];

    // Логирование
    await logAction(
      req.user.id,
      'UPDATE',
      'User',
      id,
      {
        action: 'role_changed',
        old_role: oldRole.name,
        new_role: newRole.name,
        username: userCheck.rows[0].username
      },
      req
    );

    res.json({
      success: true,
      message: `Роль пользователя изменена на "${newRole.name}"`,
      data: {
        user_id: parseInt(id),
        new_role: newRole.name
      }
    });
  } catch (err) {
    console.error('❌ Ошибка изменения роли:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при изменении роли пользователя'
    });
  }
};

/**
 * Переключить статус пользователя (активировать/деактивировать)
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Запрет деактивации собственного аккаунта
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Вы не можете деактивировать свой собственный аккаунт'
      });
    }

    // Проверка существования пользователя
    const userCheck = await query(
      'SELECT id, username, is_active FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    const currentStatus = userCheck.rows[0].is_active;
    const newStatus = !currentStatus;

    // Обновление статуса с установкой/сбросом даты деактивации
    if (newStatus) {
      // Активируем - сбрасываем дату деактивации
      await query(
        'UPDATE users SET is_active = $1, deactivated_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStatus, id]
      );
    } else {
      // Деактивируем - устанавливаем дату деактивации
      await query(
        'UPDATE users SET is_active = $1, deactivated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStatus, id]
      );
    }

    // Логирование
    await logAction(
      req.user.id,
      'UPDATE',
      'User',
      id,
      {
        action: 'status_changed',
        username: userCheck.rows[0].username,
        old_status: currentStatus ? 'active' : 'inactive',
        new_status: newStatus ? 'active' : 'inactive',
        auto_delete_scheduled: !newStatus
      },
      req
    );

    res.json({
      success: true,
      message: newStatus
        ? 'Пользователь активирован'
        : 'Пользователь деактивирован. Автоматическое удаление через 60 дней.',
      data: {
        user_id: parseInt(id),
        is_active: newStatus
      }
    });
  } catch (err) {
    console.error('❌ Ошибка изменения статуса:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при изменении статуса пользователя'
    });
  }
};

/**
 * Удалить пользователей, деактивированных более 60 дней назад
 */
const cleanupDeactivatedUsers = async () => {
  try {
    // Найти пользователей для удаления
    const usersToDelete = await query(
      `SELECT id, username, email FROM users
       WHERE is_active = false
       AND deactivated_at IS NOT NULL
       AND deactivated_at < CURRENT_TIMESTAMP - INTERVAL '60 days'`
    );

    if (usersToDelete.rows.length === 0) {
      console.log('✅ Нет пользователей для автоматического удаления');
      return { deleted: 0, users: [] };
    }

    const deletedUsers = [];

    for (const user of usersToDelete.rows) {
      // Проверка связей (офферы, созданные пользователем)
      const offersCheck = await query(
        'SELECT COUNT(*) as count FROM offers WHERE created_by = $1',
        [user.id]
      );
      const offersCount = parseInt(offersCheck.rows[0].count);

      if (offersCount === 0) {
        // Удаляем пользователя
        await query('DELETE FROM users WHERE id = $1', [user.id]);
        deletedUsers.push(user);
        console.log(`🗑️ Автоматически удалён пользователь: ${user.username} (деактивирован более 60 дней назад)`);
      } else {
        console.log(`⚠️ Пользователь ${user.username} не удалён: существует ${offersCount} офферов`);
      }
    }

    return { deleted: deletedUsers.length, users: deletedUsers };
  } catch (err) {
    console.error('❌ Ошибка автоматической очистки пользователей:', err);
    return { deleted: 0, error: err.message };
  }
};

/**
 * Удалить пользователя
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Запрет удаления собственного аккаунта
    if (parseInt(id) === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Вы не можете удалить свой собственный аккаунт'
      });
    }

    // Проверка существования пользователя
    const userCheck = await query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    const user = userCheck.rows[0];

    // Проверка связей (офферы, созданные пользователем)
    const offersCheck = await query(
      'SELECT COUNT(*) as count FROM offers WHERE created_by = $1',
      [id]
    );
    const offersCount = parseInt(offersCheck.rows[0].count);

    if (offersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Невозможно удалить пользователя: существует ${offersCount} офферов, созданных этим пользователем. Сначала переназначьте или удалите офферы.`
      });
    }

    // Удаление пользователя
    await query('DELETE FROM users WHERE id = $1', [id]);

    // Логирование
    await logAction(
      req.user.id,
      'DELETE',
      'User',
      id,
      { username: user.username, email: user.email },
      req
    );

    res.json({
      success: true,
      message: 'Пользователь успешно удалён'
    });
  } catch (err) {
    console.error('❌ Ошибка удаления пользователя:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении пользователя'
    });
  }
};

/**
 * Получить список доступных ролей
 */
const getRoles = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, permissions FROM roles ORDER BY id'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error('❌ Ошибка получения ролей:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка ролей'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  changeUserRole,
  toggleUserStatus,
  deleteUser,
  getRoles,
  cleanupDeactivatedUsers
};
