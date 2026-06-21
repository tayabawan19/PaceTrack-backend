const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT and attach user context to the request.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token, authorization denied. Format: Bearer <token>' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pacetrack_jwt_secret_dev_key');
    
    // Attach userId to req.user as requested by the prompt
    req.user = {
      userId: decoded.userId,
      id: decoded.userId // Include id alias for standard convenience
    };
    
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ error: 'Token is not valid or has expired' });
  }
};

module.exports = authMiddleware;
