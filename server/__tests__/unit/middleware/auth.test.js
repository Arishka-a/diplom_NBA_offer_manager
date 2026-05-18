const jwt = require('jsonwebtoken');

// Mock database
jest.mock('../../../src/config/database', () => ({
  query: jest.fn()
}));

const { query } = require('../../../src/config/database');
const { authenticateToken, requireRole, requirePermission } = require('../../../src/middleware/auth');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should return 401 if no token provided', async () => {
      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Токен доступа не предоставлен'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      mockReq.headers['authorization'] = 'Bearer invalid-token';

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Недействительный токен'
      });
    });

    it('should return 401 if token is expired', async () => {
      const expiredToken = jwt.sign(
        { userId: 1 },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      mockReq.headers['authorization'] = `Bearer ${expiredToken}`;

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Токен истёк'
      });
    });

    it('should return 401 if user not found in database', async () => {
      const token = jwt.sign({ userId: 999 }, process.env.JWT_SECRET);
      mockReq.headers['authorization'] = `Bearer ${token}`;

      query.mockResolvedValue({ rows: [] });

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Пользователь не найден'
      });
    });

    it('should return 403 if user is deactivated', async () => {
      const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
      mockReq.headers['authorization'] = `Bearer ${token}`;

      query.mockResolvedValue({
        rows: [{
          id: 1,
          username: 'testuser',
          email: 'test@test.com',
          is_active: false,
          role: 'user',
          permissions: {}
        }]
      });

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Учётная запись деактивирована'
      });
    });

    it('should set req.user and call next() for valid token and active user', async () => {
      const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
      mockReq.headers['authorization'] = `Bearer ${token}`;

      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@test.com',
        is_active: true,
        role: 'admin',
        permissions: { offers: ['read', 'write'] }
      };

      query.mockResolvedValue({ rows: [mockUser] });

      await authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('should return 401 if no user in request', () => {
      const middleware = requireRole('admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Не авторизован'
      });
    });

    it('should return 403 if user role does not match', () => {
      mockReq.user = { role: 'user' };
      const middleware = requireRole('admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Недостаточно прав доступа'
      });
    });

    it('should call next() if user has required role', () => {
      mockReq.user = { role: 'admin' };
      const middleware = requireRole('admin', 'superadmin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access if user has one of multiple allowed roles', () => {
      mockReq.user = { role: 'manager' };
      const middleware = requireRole('admin', 'manager', 'operator');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should return 403 if no user in request', () => {
      const middleware = requirePermission('offers', 'read');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Недостаточно прав доступа'
      });
    });

    it('should return 403 if permissions is not an object', () => {
      mockReq.user = { permissions: 'invalid' };
      const middleware = requirePermission('offers', 'read');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 403 if resource not in permissions', () => {
      mockReq.user = { permissions: { segments: ['read'] } };
      const middleware = requirePermission('offers', 'read');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Нет разрешения на read для offers'
      });
    });

    it('should return 403 if action not in resource permissions', () => {
      mockReq.user = { permissions: { offers: ['read'] } };
      const middleware = requirePermission('offers', 'write');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Нет разрешения на write для offers'
      });
    });

    it('should call next() if user has required permission', () => {
      mockReq.user = {
        permissions: {
          offers: ['read', 'write', 'delete'],
          segments: ['read']
        }
      };
      const middleware = requirePermission('offers', 'write');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
