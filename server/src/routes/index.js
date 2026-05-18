const express = require('express');
const router = express.Router();

// Контроллеры
const authController = require('../controllers/authController');
const offerController = require('../controllers/offerController');
const segmentController = require('../controllers/segmentController');
const logController = require('../controllers/logController');
const ruleController = require('../controllers/ruleController');
const importExportController = require('../controllers/importExportController');
const offerHistoryController = require('../controllers/offerHistoryController');
const customerController = require('../controllers/customerController');
const dashboardController = require('../controllers/dashboardController');
const nbaController = require('../controllers/nbaController');
const userController = require('../controllers/userController');
const conditionController = require('../controllers/conditionController');
const reportController = require('../controllers/reportController');

// Middleware
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateCreateOffer,
  validateUpdateOffer,
  validateCreateSegment,
  validateUpdateSegment,
  validatePagination,
  validateId,
  validateEntityHistory
} = require('../middleware/validation');

// ============================================================================
// AUTH ROUTES - /api/v1/auth
// ============================================================================
router.post('/auth/register', validateRegister, authController.register);
router.post('/auth/login', validateLogin, authController.login);
router.get('/auth/profile', authenticateToken, authController.getProfile);
router.post('/auth/logout', authenticateToken, authController.logout);
router.post('/auth/request-password-reset', authController.requestPasswordReset);
router.post('/auth/reset-password', authController.resetPassword);

// ============================================================================
// DASHBOARD ROUTES - /api/v1/dashboard
// ============================================================================
router.get('/dashboard/stats', authenticateToken, dashboardController.getDashboardStats);

// ============================================================================
// REPORTS ROUTES - /api/v1/reports
// ============================================================================
// Общая статистика
router.get('/reports/dashboard', authenticateToken, requirePermission('reports', 'read'), reportController.getDashboardStats);

// Отчеты по офферам
router.get('/reports/offers/performance', authenticateToken, requirePermission('reports', 'read'), reportController.getOfferPerformanceReport);
router.get('/reports/offers/by-type', authenticateToken, requirePermission('reports', 'read'), reportController.getOfferTypeReport);
router.get('/reports/offers/top-conversion', authenticateToken, requirePermission('reports', 'read'), reportController.getTopOffersByConversion);
router.get('/reports/offers/top-views', authenticateToken, requirePermission('reports', 'read'), reportController.getTopOffersByViews);

// Отчеты по сегментам
router.get('/reports/segments/performance', authenticateToken, requirePermission('reports', 'read'), reportController.getSegmentPerformanceReport);
router.get('/reports/segments/distribution', authenticateToken, requirePermission('reports', 'read'), reportController.getCustomerSegmentDistribution);

// Отчеты по взаимодействиям
router.get('/reports/interactions/trend', authenticateToken, requirePermission('reports', 'read'), reportController.getInteractionsTrendReport);

// Отчеты по клиентам
router.get('/reports/customers/stats', authenticateToken, requirePermission('reports', 'read'), reportController.getCustomerStatsReport);

// Отчеты по активности пользователей
router.get('/reports/users/activity', authenticateToken, requirePermission('reports', 'read'), reportController.getUserActivityReport);

// Отчеты по правилам
router.get('/reports/rules', authenticateToken, requirePermission('reports', 'read'), reportController.getRulesReport);

// Экспорт в PDF
router.get('/reports/export/pdf', authenticateToken, requirePermission('reports', 'read'), reportController.exportToPdf);

// ============================================================================
// OFFERS ROUTES - /api/v1/offers
// ============================================================================
router.get('/offers', authenticateToken, validatePagination, offerController.getOffers);
router.get('/offers/:id', authenticateToken, validateId, offerController.getOfferById);
router.post('/offers', authenticateToken, requirePermission('offers', 'create'), validateCreateOffer, offerController.createOffer);
router.put('/offers/:id', authenticateToken, requirePermission('offers', 'update'), validateUpdateOffer, offerController.updateOffer);
router.delete('/offers/:id', authenticateToken, requirePermission('offers', 'delete'), validateId, offerController.deleteOffer);

// ============================================================================
// CONDITIONS ROUTES - /api/v1/conditions
// ============================================================================
router.get('/conditions/types', authenticateToken, conditionController.getConditionTypes);
router.get('/conditions/offer/:offerId', authenticateToken, conditionController.getConditionsByOfferId);
router.get('/conditions/:id', authenticateToken, validateId, conditionController.getConditionById);
router.post('/conditions', authenticateToken, requirePermission('offers', 'create'), conditionController.createCondition);
router.put('/conditions/:id', authenticateToken, requirePermission('offers', 'update'), validateId, conditionController.updateCondition);
router.delete('/conditions/:id', authenticateToken, requirePermission('offers', 'delete'), validateId, conditionController.deleteCondition);

// ============================================================================
// SEGMENTS ROUTES - /api/v1/segments
// ============================================================================
router.get('/segments', authenticateToken, validatePagination, segmentController.getSegments);
router.get('/segments/:id', authenticateToken, validateId, segmentController.getSegmentById);
router.post('/segments', authenticateToken, requirePermission('segments', 'create'), validateCreateSegment, segmentController.createSegment);
router.put('/segments/:id', authenticateToken, requirePermission('segments', 'update'), validateUpdateSegment, segmentController.updateSegment);
router.delete('/segments/:id', authenticateToken, requireRole('Administrator'), validateId, segmentController.deleteSegment);

// ============================================================================
// LOGS ROUTES - /api/v1/logs
// ============================================================================
router.get('/logs', authenticateToken, requirePermission('logs', 'read'), validatePagination, logController.getLogs);
router.get('/history/:entity_type/:entity_id', authenticateToken, validateEntityHistory, logController.getEntityHistory);

// ============================================================================
// RULES ROUTES - /api/v1/rules
// ============================================================================
router.get('/rules', authenticateToken, requirePermission('rules', 'read'), validatePagination, ruleController.getRules);
router.get('/rules/statistics/all', authenticateToken, requirePermission('rules', 'read'), ruleController.getAllRulesStatistics);
router.get('/rules/:id', authenticateToken, requirePermission('rules', 'read'), validateId, ruleController.getRuleById);
router.post('/rules', authenticateToken, requirePermission('rules', 'create'), ruleController.createRule);
router.put('/rules/:id', authenticateToken, requirePermission('rules', 'update'), validateId, ruleController.updateRule);
router.delete('/rules/:id', authenticateToken, requirePermission('rules', 'delete'), validateId, ruleController.deleteRule);
router.get('/rules/:id/statistics', authenticateToken, requirePermission('rules', 'read'), validateId, ruleController.getRuleStatistics);
router.get('/rules/:id/executions', authenticateToken, requirePermission('rules', 'read'), validateId, ruleController.getRuleExecutions);

// ============================================================================
// CUSTOMERS ROUTES - /api/v1/customers
// ============================================================================
router.get('/customers', authenticateToken, requirePermission('customers', 'read'), validatePagination, customerController.getCustomers);
router.get('/customers/analytics', authenticateToken, requirePermission('customers', 'read'), customerController.getCustomerAnalytics);
router.get('/customers/segment-distribution', authenticateToken, requirePermission('customers', 'read'), customerController.getSegmentDistribution);
router.get('/customers/:id', authenticateToken, requirePermission('customers', 'read'), validateId, customerController.getCustomerById);
router.post('/customers', authenticateToken, requirePermission('customers', 'create'), customerController.createCustomer);
router.put('/customers/:id', authenticateToken, requirePermission('customers', 'update'), validateId, customerController.updateCustomer);
router.delete('/customers/:id', authenticateToken, requirePermission('customers', 'delete'), validateId, customerController.deleteCustomer);

// ============================================================================
// OFFER HISTORY ROUTES - /api/v1/offer-history
// ============================================================================
router.get('/offer-history', authenticateToken, requirePermission('offers', 'read'), validatePagination, offerHistoryController.getOfferHistory);
router.get('/offer-history/customer/:customerId', authenticateToken, requirePermission('offers', 'read'), offerHistoryController.getCustomerOfferHistory);
router.get('/offer-history/conversion-stats', authenticateToken, requirePermission('offers', 'read'), offerHistoryController.getConversionStats);
router.get('/offer-history/performance/:offerId', authenticateToken, requirePermission('offers', 'read'), validateId, offerHistoryController.getOfferPerformance);
router.post('/offer-history', authenticateToken, requirePermission('offers', 'create'), offerHistoryController.createOfferHistory);
router.put('/offer-history/:id', authenticateToken, requirePermission('offers', 'update'), validateId, offerHistoryController.updateOfferHistory);

// ============================================================================
// NBA (NEXT BEST ACTION) ROUTES - /api/v1/nba
// ============================================================================
// Рекомендации для клиентов
router.get('/nba/recommendations/:customerId', authenticateToken, requirePermission('offers', 'read'), nbaController.getRecommendations);
router.get('/nba/stats/:customerId', authenticateToken, requirePermission('offers', 'read'), nbaController.getCustomerStats);

// Рекомендации для сегментов (основная функция)
router.get('/nba/recommendations/segment/:segmentId', authenticateToken, requirePermission('offers', 'read'), nbaController.getSegmentRecommendations);
router.get('/nba/stats/segment/:segmentId', authenticateToken, requirePermission('offers', 'read'), nbaController.getSegmentStats);

// Управление показами и статусами офферов
router.post('/nba/record-shown', authenticateToken, requirePermission('offers', 'create'), nbaController.recordShown);
router.put('/nba/update-status/:historyId', authenticateToken, requirePermission('offers', 'update'), nbaController.updateStatus);

// ============================================================================
// IMPORT/EXPORT ROUTES - /api/v1/import, /api/v1/export
// ============================================================================
// Import
router.post('/import/offers', authenticateToken, requirePermission('import', 'execute'), importExportController.importOffersController);
router.post('/import/segments', authenticateToken, requirePermission('import', 'execute'), importExportController.importSegmentsController);

// Export
router.get('/export/offers', authenticateToken, requirePermission('offers', 'read'), importExportController.exportOffersController);
router.get('/export/segments', authenticateToken, requirePermission('segments', 'read'), importExportController.exportSegmentsController);
router.get('/export/rules', authenticateToken, requirePermission('rules', 'read'), importExportController.exportRulesController);
router.get('/export/logs', authenticateToken, requirePermission('logs', 'read'), importExportController.exportLogsController);

// ============================================================================
// USERS MANAGEMENT ROUTES - /api/v1/users (Только для администратора)
// ============================================================================
router.get('/users', authenticateToken, requireRole('Administrator'), validatePagination, userController.getAllUsers);
router.get('/users/:id', authenticateToken, requireRole('Administrator'), validateId, userController.getUserById);
router.post('/users', authenticateToken, requireRole('Administrator'), userController.createUser);
router.put('/users/:id', authenticateToken, requireRole('Administrator'), validateId, userController.updateUser);
router.patch('/users/:id/role', authenticateToken, requireRole('Administrator'), validateId, userController.changeUserRole);
router.patch('/users/:id/status', authenticateToken, requireRole('Administrator'), validateId, userController.toggleUserStatus);
router.delete('/users/:id', authenticateToken, requireRole('Administrator'), validateId, userController.deleteUser);

// Получение списка ролей
router.get('/roles', authenticateToken, userController.getRoles);

// ============================================================================
// HEALTH CHECK
// ============================================================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API работает',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
