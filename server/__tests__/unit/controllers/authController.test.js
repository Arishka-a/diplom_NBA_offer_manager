const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../../../src/services/logService', () => ({
  logAction: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../src/services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendPasswordChangedEmail: jest.fn().mockResolvedValue(true)
}));

const { query } = require('../../../src/config/database');
const { logAction } = require('../../../src/services/logService');
const authController = require('../../../src/controllers/authController');

describe('Auth Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      body: {},
      user: null,
      headers: {},
      ip: '127.0.0.1'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should return 400 if user already exists', async () => {
      mockReq.body = {
        username: 'existinguser',
        email: 'existing@test.com',
        password: 'password123'
      };

      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Пользователь с таким логином или email уже существует'
      });
    });

    it('should create user and return token on success', async () => {
      mockReq.body = {
        username: 'newuser',
        email: 'new@test.com',
        password: 'password123'
      };

      // No existing user
      query.mockResolvedValueOnce({ rows: [] });

      // Created user
      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'newuser',
          email: 'new@test.com',
          created_at: new Date()
        }]
      });

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Регистрация успешна',
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 1,
              username: 'newuser',
              role: 'Operator'
            }),
            token: expect.any(String)
          })
        })
      );
      expect(logAction).toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      mockReq.body = {
        username: 'newuser',
        email: 'new@test.com',
        password: 'password123'
      };

      query.mockRejectedValueOnce(new Error('Database error'));

      await authController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Ошибка сервера при регистрации'
      });
    });
  });

  describe('login', () => {
    it('should return 401 if user not found', async () => {
      mockReq.body = { username: 'unknown', password: 'password' };

      query.mockResolvedValueOnce({ rows: [] });

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Неверный логин или пароль'
      });
    });

    it('should return 403 if user is deactivated', async () => {
      mockReq.body = { username: 'inactive', password: 'password' };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'inactive',
          password_hash: 'hash',
          is_active: false,
          role: 'Operator',
          permissions: {}
        }]
      });

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Учётная запись деактивирована'
      });
    });

    it('should return 401 if password is invalid', async () => {
      mockReq.body = { username: 'testuser', password: 'wrongpassword' };

      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'testuser',
          password_hash: hashedPassword,
          is_active: true,
          role: 'Operator',
          permissions: {}
        }]
      });

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Неверный логин или пароль'
      });
    });

    it('should return token on successful login', async () => {
      const password = 'correctpassword';
      const hashedPassword = await bcrypt.hash(password, 10);

      mockReq.body = { username: 'testuser', password };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'testuser',
          email: 'test@test.com',
          password_hash: hashedPassword,
          is_active: true,
          role: 'Admin',
          permissions: { offers: ['read', 'write'] }
        }]
      });

      // Update last_login
      query.mockResolvedValueOnce({ rows: [] });

      await authController.login(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Вход выполнен успешно',
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 1,
              username: 'testuser',
              role: 'Admin'
            }),
            token: expect.any(String)
          })
        })
      );
      expect(logAction).toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      mockReq.user = { id: 1 };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'testuser',
          email: 'test@test.com',
          created_at: new Date(),
          last_login: new Date(),
          role: 'Operator',
          permissions: {}
        }]
      });

      await authController.getProfile(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 1,
          username: 'testuser'
        })
      });
    });

    it('should return 404 if user not found', async () => {
      mockReq.user = { id: 999 };

      query.mockResolvedValueOnce({ rows: [] });

      await authController.getProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Пользователь не найден'
      });
    });
  });

  describe('logout', () => {
    it('should log action and return success', async () => {
      mockReq.user = { id: 1 };

      await authController.logout(mockReq, mockRes);

      expect(logAction).toHaveBeenCalledWith(1, 'LOGOUT', 'User', 1, null, mockReq);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Выход выполнен успешно'
      });
    });
  });

  describe('requestPasswordReset', () => {
    it('should return 400 if email not provided', async () => {
      mockReq.body = {};

      await authController.requestPasswordReset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email обязателен для заполнения'
      });
    });

    it('should return success message even if user not found (security)', async () => {
      mockReq.body = { email: 'unknown@test.com' };

      query.mockResolvedValueOnce({ rows: [] });

      await authController.requestPasswordReset(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Если email существует в системе, на него будет отправлена ссылка для восстановления пароля'
      });
    });

    it('should return 403 if user is deactivated', async () => {
      mockReq.body = { email: 'inactive@test.com' };

      query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          username: 'inactive',
          email: 'inactive@test.com',
          is_active: false
        }]
      });

      await authController.requestPasswordReset(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('resetPassword', () => {
    it('should return 400 if token or password not provided', async () => {
      mockReq.body = { token: 'sometoken' };

      await authController.resetPassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Токен и новый пароль обязательны для заполнения'
      });
    });

    it('should return 400 if password is too short', async () => {
      mockReq.body = { token: 'sometoken', newPassword: '123' };

      await authController.resetPassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Пароль должен содержать минимум 6 символов'
      });
    });

    it('should return 400 if token is invalid', async () => {
      mockReq.body = { token: 'invalidtoken', newPassword: 'newpassword123' };

      query.mockResolvedValueOnce({ rows: [] });

      await authController.resetPassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Недействительный или истёкший токен восстановления'
      });
    });
  });
});
