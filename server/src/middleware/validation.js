const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validation rules for authentication endpoints
 */
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores and hyphens'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  handleValidationErrors
];

const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

/**
 * Validation rules for offer endpoints
 */
const validateCreateOffer = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),

  body('description')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),

  body('offer_type')
    .isIn(['discount', 'bonus', 'upgrade', 'retention', 'recommendation'])
    .withMessage('Invalid offer type'),

  body('priority')
    .isInt({ min: 1, max: 100 })
    .withMessage('Priority must be an integer between 1 and 100'),

  body('start_date')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (value && req.body.start_date && new Date(value) <= new Date(req.body.start_date)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  body('segment_ids')
    .optional()
    .isArray()
    .withMessage('Segment IDs must be an array'),

  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive', 'archived'])
    .withMessage('Invalid status'),

  handleValidationErrors
];

const validateUpdateOffer = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Offer ID must be a positive integer'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Description must be between 1 and 2000 characters'),

  body('offer_type')
    .optional()
    .isIn(['discount', 'bonus', 'upgrade', 'retention', 'recommendation'])
    .withMessage('Invalid offer type'),

  body('priority')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Priority must be an integer between 1 and 100'),

  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),

  body('segment_ids')
    .optional()
    .isArray()
    .withMessage('Segment IDs must be an array'),

  body('status')
    .optional()
    .isIn(['draft', 'active', 'inactive', 'archived'])
    .withMessage('Invalid status'),

  handleValidationErrors
];

/**
 * Validation rules for segment endpoints
 */
const validateCreateSegment = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  body('criteria')
    .optional(),

  body('client_count')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Client count must be a non-negative integer'),

  handleValidationErrors
];

const validateUpdateSegment = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Segment ID must be a positive integer'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1 and 255 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),

  body('criteria')
    .optional(),

  body('client_count')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Client count must be a non-negative integer'),

  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),

  handleValidationErrors
];

/**
 * Validation rules for query parameters
 */
const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('sortField')
    .optional()
    .isString()
    .withMessage('Sort field must be a string'),

  query('sortDir')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort direction must be ASC or DESC'),

  handleValidationErrors
];

/**
 * Validation rules for ID parameters
 */
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),

  handleValidationErrors
];

const validateEntityHistory = [
  param('entity_type')
    .isIn(['offer', 'segment', 'user', 'Offer', 'Segment', 'User', 'Rule', 'Condition', 'Customer'])
    .withMessage('Entity type must be one of: Offer, Segment, User, Rule, Condition, Customer'),

  param('entity_id')
    .isInt({ min: 1 })
    .withMessage('Entity ID must be a positive integer'),

  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateOffer,
  validateUpdateOffer,
  validateCreateSegment,
  validateUpdateSegment,
  validatePagination,
  validateId,
  validateEntityHistory,
  handleValidationErrors
};
