/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors and pass them to error middleware
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     // async code here
 *   }));
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global error handling middleware
 * Should be added after all routes
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err);

  // Default to 500 server error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Don't leak error details in production
  const response = {
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    })
  };

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 * Should be added before error handler but after all routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  asyncHandler,
  errorHandler,
  notFoundHandler
};
