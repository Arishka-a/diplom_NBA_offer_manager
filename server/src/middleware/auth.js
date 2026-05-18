const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Проверка JWT токена
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Токен доступа не предоставлен' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Получаем пользователя из БД
    const result = await query(
      `SELECT u.id, u.username, u.email, u.is_active, r.name as role, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Пользователь не найден' 
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Учётная запись деактивирована' 
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Токен истёк' 
      });
    }
    return res.status(403).json({ 
      success: false, 
      message: 'Недействительный токен' 
    });
  }
};

// Проверка роли
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Не авторизован'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав доступа'
      });
    }

    next();
  };
};

// Проверка конкретного разрешения
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав доступа'
      });
    }

    const permissions = req.user.permissions;

    // Ensure permissions is an object
    if (typeof permissions !== 'object' || permissions === null) {
      return res.status(403).json({
        success: false,
        message: 'Недостаточно прав доступа'
      });
    }

    // Check if resource exists and has the required action
    if (!permissions[resource] ||
        !Array.isArray(permissions[resource]) ||
        !permissions[resource].includes(action)) {
      return res.status(403).json({
        success: false,
        message: `Нет разрешения на ${action} для ${resource}`
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission
};
