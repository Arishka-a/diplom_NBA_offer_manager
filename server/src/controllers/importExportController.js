const multer = require('multer');
const { parseFile } = require('../utils/fileParser');
const { importOffers, importSegments } = require('../services/importService');
const { exportOffers, exportSegments, exportRules, exportLogs } = require('../services/exportService');
const { logAction } = require('../services/logService');

// Настройка multer для загрузки файлов в память
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат файла. Используйте CSV или Excel (xlsx)'));
    }
  }
}).single('file');

/**
 * Импорт офферов
 */
const importOffersController = async (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    try {
      // Парсинг файла
      const data = parseFile(req.file.buffer, req.file.mimetype);

      if (!data || data.length === 0) {
        return res.status(400).json({ error: 'Файл пуст или не содержит данных' });
      }

      // Импорт данных
      const results = await importOffers(
        data,
        req.user.id,
        req.ip,
        req.get('user-agent')
      );

      // Логирование операции импорта
      await logAction(
        req.user.id,
        'IMPORT',
        'offers',
        0,
        {
          filename: req.file.originalname,
          records_count: data.length,
          results: {
            created: results.created,
            errors: results.errors.length
          }
        },
        req
      );

      res.json({
        message: 'Импорт офферов завершен',
        results
      });
    } catch (error) {
      console.error('Import error:', error);
      next(error);
    }
  });
};

/**
 * Импорт сегментов
 */
const importSegmentsController = async (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    try {
      // Парсинг файла
      const data = parseFile(req.file.buffer, req.file.mimetype);

      if (!data || data.length === 0) {
        return res.status(400).json({ error: 'Файл пуст или не содержит данных' });
      }

      // Импорт данных
      const results = await importSegments(
        data,
        req.user.id,
        req.ip,
        req.get('user-agent')
      );

      // Логирование операции импорта
      await logAction(
        req.user.id,
        'IMPORT',
        'segments',
        0,
        {
          filename: req.file.originalname,
          records_count: data.length,
          results: {
            created: results.created,
            errors: results.errors.length
          }
        },
        req
      );

      res.json({
        message: 'Импорт сегментов завершен',
        results
      });
    } catch (error) {
      console.error('Import error:', error);
      next(error);
    }
  });
};

/**
 * Экспорт офферов
 */
const exportOffersController = async (req, res, next) => {
  try {
    const format = req.query.format || 'csv';

    const { buffer, filename, mimetype } = await exportOffers(format);

    // Логирование операции экспорта
    await logAction(
      req.user.id,
      'EXPORT',
      'offers',
      0,
      {
        format,
        filename
      },
      req
    );

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    next(error);
  }
};

/**
 * Экспорт сегментов
 */
const exportSegmentsController = async (req, res, next) => {
  try {
    const format = req.query.format || 'csv';

    const { buffer, filename, mimetype } = await exportSegments(format);

    // Логирование операции экспорта
    await logAction(
      req.user.id,
      'EXPORT',
      'segments',
      0,
      {
        format,
        filename
      },
      req
    );

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    next(error);
  }
};

/**
 * Экспорт правил
 */
const exportRulesController = async (req, res, next) => {
  try {
    const format = req.query.format || 'csv';

    const { buffer, filename, mimetype } = await exportRules(format);

    // Логирование операции экспорта
    await logAction(
      req.user.id,
      'EXPORT',
      'rules',
      0,
      {
        format,
        filename
      },
      req
    );

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    next(error);
  }
};

/**
 * Экспорт логов
 */
const exportLogsController = async (req, res, next) => {
  try {
    const format = req.query.format || 'csv';
    const filters = {
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      action: req.query.action,
      entityType: req.query.entity_type
    };

    const { buffer, filename, mimetype } = await exportLogs(format, filters);

    // Логирование операции экспорта
    await logAction(
      req.user.id,
      'EXPORT',
      'logs',
      0,
      {
        format,
        filename,
        filters
      },
      req
    );

    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    next(error);
  }
};

module.exports = {
  importOffersController,
  importSegmentsController,
  exportOffersController,
  exportSegmentsController,
  exportRulesController,
  exportLogsController
};
