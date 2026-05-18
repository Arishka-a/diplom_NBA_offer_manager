const reportService = require('../services/reportService');
const pdfService = require('../services/pdfService');
const { logAction } = require('../services/logService');

/**
 * Получить общую статистику для дашборда
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await reportService.getDashboardStats();

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'dashboard' },
      req
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    next(error);
  }
};

/**
 * Получить отчет по эффективности офферов
 */
const getOfferPerformanceReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getOfferPerformanceReport(start_date, end_date);

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'offer_performance', start_date, end_date },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get offer performance report error:', error);
    next(error);
  }
};

/**
 * Получить отчет по типам офферов
 */
const getOfferTypeReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getOfferTypeReport(start_date, end_date);

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'offer_type', start_date, end_date },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get offer type report error:', error);
    next(error);
  }
};

/**
 * Получить отчет по эффективности сегментов
 */
const getSegmentPerformanceReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getSegmentPerformanceReport(start_date, end_date);

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'segment_performance', start_date, end_date },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get segment performance report error:', error);
    next(error);
  }
};

/**
 * Получить тренд взаимодействий с офферами
 */
const getInteractionsTrendReport = async (req, res, next) => {
  try {
    const { start_date, end_date, interval = 'day' } = req.query;
    const report = await reportService.getInteractionsTrendReport(start_date, end_date, interval);

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'interactions_trend', start_date, end_date, interval },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get interactions trend report error:', error);
    next(error);
  }
};

/**
 * Получить топ офферов по конверсии
 */
const getTopOffersByConversion = async (req, res, next) => {
  try {
    const { limit = 10, start_date, end_date } = req.query;
    const report = await reportService.getTopOffersByConversion(parseInt(limit), start_date, end_date);

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'top_offers_conversion', limit, start_date, end_date },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get top offers by conversion error:', error);
    next(error);
  }
};

/**
 * Получить топ офферов по просмотрам
 */
const getTopOffersByViews = async (req, res, next) => {
  try {
    const { limit = 10, start_date, end_date } = req.query;
    const report = await reportService.getTopOffersByViews(parseInt(limit), start_date, end_date);

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'top_offers_views', limit, start_date, end_date },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get top offers by views error:', error);
    next(error);
  }
};

/**
 * Получить отчет по активности пользователей системы
 */
const getUserActivityReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const report = await reportService.getUserActivityReport(start_date, end_date);

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'user_activity', start_date, end_date },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get user activity report error:', error);
    next(error);
  }
};

/**
 * Получить статистику по клиентам
 */
const getCustomerStatsReport = async (req, res, next) => {
  try {
    const report = await reportService.getCustomerStatsReport();

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'customer_stats' },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get customer stats report error:', error);
    next(error);
  }
};

/**
 * Получить распределение клиентов по сегментам
 */
const getCustomerSegmentDistribution = async (req, res, next) => {
  try {
    const report = await reportService.getCustomerSegmentDistribution();

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'customer_segment_distribution' },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get customer segment distribution error:', error);
    next(error);
  }
};

/**
 * Получить отчет по правилам NBA
 */
const getRulesReport = async (req, res, next) => {
  try {
    const report = await reportService.getRulesReport();

    await logAction(
      req.user.id,
      'VIEW',
      'reports',
      0,
      { report_type: 'rules' },
      req
    );

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get rules report error:', error);
    next(error);
  }
};

/**
 * Экспорт аналитического отчёта в PDF
 */
const exportToPdf = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    console.log('Starting PDF export...', { start_date, end_date });

    // Генерируем PDF
    const doc = await pdfService.generateAnalyticsReport(start_date, end_date);

    console.log('PDF document generated, sending response...');

    // Устанавливаем заголовки для скачивания файла
    const filename = `nba_analytics_report_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Отправляем PDF в ответе
    doc.pipe(res);
    doc.end();

    // Логируем действие после отправки
    logAction(
      req.user.id,
      'EXPORT',
      'reports',
      0,
      { report_type: 'pdf_analytics', start_date, end_date },
      req
    ).catch(err => console.error('Log action error:', err));

  } catch (error) {
    console.error('Export to PDF error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating PDF report',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getOfferPerformanceReport,
  getOfferTypeReport,
  getSegmentPerformanceReport,
  getInteractionsTrendReport,
  getTopOffersByConversion,
  getTopOffersByViews,
  getUserActivityReport,
  getCustomerStatsReport,
  getCustomerSegmentDistribution,
  getRulesReport,
  exportToPdf
};
