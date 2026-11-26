export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Basic Express error handling middleware
export function errorHandler(err, req, res, _next) {
  console.error(err.message);
  if (res.headersSent) return _next(err);
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.name === 'MulterError' || err.name === 'CastError' ? 400 : err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal server error" });
}
