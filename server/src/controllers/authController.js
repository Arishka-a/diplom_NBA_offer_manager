const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const { logAction } = require('../services/logService');
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require('../services/emailService');

// Регистрация пользователя
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

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

    // Хэширование пароля
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Создание пользователя (роль Operator по умолчанию)
    const result = await query(
      `INSERT INTO users (username, email, password_hash, role_id)
       VALUES ($1, $2, $3, 1)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );

    const user = result.rows[0];

    // Логирование
    await logAction(user.id, 'CREATE', 'User', user.id, { username, email }, req);

    // Генерация токена
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Регистрация успешна',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: 'Operator'
        },
        token
      }
    });
  } catch (err) {
    console.error('❌ Ошибка регистрации:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при регистрации'
    });
  }
};

// Вход в систему
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Поиск пользователя
    const result = await query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.is_active,
              r.name as role, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1 OR u.email = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Неверный логин или пароль'
      });
    }

    const user = result.rows[0];

    // Проверка активности
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Учётная запись деактивирована'
      });
    }

    // Проверка пароля
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Неверный логин или пароль'
      });
    }

    // Обновление last_login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Логирование входа
    await logAction(user.id, 'LOGIN', 'User', user.id, { method: 'password' }, req);

    // Генерация токена
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        },
        token
      }
    });
  } catch (err) {
    console.error('❌ Ошибка входа:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при входе'
    });
  }
};

// Получение профиля
const getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.created_at, u.last_login,
              r.name as role, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
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
    console.error('❌ Ошибка получения профиля:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Выход (логирование)
const logout = async (req, res) => {
  try {
    await logAction(req.user.id, 'LOGOUT', 'User', req.user.id, null, req);

    res.json({
      success: true,
      message: 'Выход выполнен успешно'
    });
  } catch (err) {
    console.error('❌ Ошибка выхода:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
};

// Запрос на восстановление пароля
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Проверка наличия email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email обязателен для заполнения'
      });
    }

    // Поиск пользователя по email
    const result = await query(
      'SELECT id, username, email, is_active FROM users WHERE email = $1',
      [email]
    );

    // Не раскрываем информацию о существовании email из соображений безопасности
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Если email существует в системе, на него будет отправлена ссылка для восстановления пароля'
      });
    }

    const user = result.rows[0];

    // Проверка активности учетной записи
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Учётная запись деактивирована. Обратитесь к администратору.'
      });
    }

    // Генерация токена восстановления (32 байта = 64 hex символа)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Хешируем токен перед сохранением в БД
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Токен действителен 1 час
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Сохранение токена в БД
    await query(
      `UPDATE users
       SET reset_token = $1, reset_token_expires = $2
       WHERE id = $3`,
      [hashedToken, expiresAt, user.id]
    );

    // Отправка email с токеном
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.username);

      // Логирование запроса на восстановление
      await logAction(user.id, 'PASSWORD_RESET_REQUEST', 'User', user.id, { email }, req);

      res.json({
        success: true,
        message: 'Инструкции по восстановлению пароля отправлены на ваш email'
      });
    } catch (emailError) {
      console.error('❌ Ошибка отправки email:', emailError);

      // Удаляем токен, если не удалось отправить email
      await query(
        'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1',
        [user.id]
      );

      return res.status(500).json({
        success: false,
        message: 'Не удалось отправить email. Проверьте настройки почты или попробуйте позже.'
      });
    }
  } catch (err) {
    console.error('❌ Ошибка запроса восстановления пароля:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при запросе восстановления пароля'
    });
  }
};

// Сброс пароля по токену
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Валидация входных данных
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Токен и новый пароль обязательны для заполнения'
      });
    }

    // Проверка длины пароля
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Пароль должен содержать минимум 6 символов'
      });
    }

    // Хешируем полученный токен для сравнения с БД
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Поиск пользователя по токену
    const result = await query(
      `SELECT id, username, email, reset_token_expires
       FROM users
       WHERE reset_token = $1 AND is_active = true`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Недействительный или истёкший токен восстановления'
      });
    }

    const user = result.rows[0];

    // Проверка срока действия токена
    if (new Date() > new Date(user.reset_token_expires)) {
      // Удаляем просроченный токен
      await query(
        'UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1',
        [user.id]
      );

      return res.status(400).json({
        success: false,
        message: 'Срок действия токена истёк. Запросите восстановление пароля заново.'
      });
    }

    // Хеширование нового пароля
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Обновление пароля и удаление токена
    await query(
      `UPDATE users
       SET password_hash = $1,
           reset_token = NULL,
           reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    // Логирование смены пароля
    await logAction(user.id, 'PASSWORD_RESET_COMPLETE', 'User', user.id, { method: 'reset_token' }, req);

    // Отправка подтверждения на email (не критично, если не отправится)
    try {
      await sendPasswordChangedEmail(user.email, user.username);
    } catch (emailError) {
      console.error('❌ Ошибка отправки подтверждения:', emailError);
      // Не возвращаем ошибку пользователю, т.к. пароль уже изменен
    }

    res.json({
      success: true,
      message: 'Пароль успешно изменён. Теперь вы можете войти с новым паролем.'
    });
  } catch (err) {
    console.error('❌ Ошибка сброса пароля:', err);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при сбросе пароля'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  logout,
  requestPasswordReset,
  resetPassword
};
