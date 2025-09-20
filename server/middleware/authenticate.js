const { verifyAuthToken } = require('../utils/generateAuthToken');

const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Extract token from "Bearer TOKEN" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // Verify the token
    const verification = verifyAuthToken(token);

    if (!verification.isValid) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid or expired token.',
        error: verification.error
      });
    }

    // Add user information to request object
    req.user = {
      userId: verification.userId,
      iat: verification.iat,
      exp: verification.exp
    };

    // Continue to the next middleware/route handler
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      error: error.message
    });
  }
};

// Optional: middleware for routes that don't require authentication but can use it
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

      if (token) {
        const verification = verifyAuthToken(token);
        
        if (verification.isValid) {
          req.user = {
            userId: verification.userId,
            iat: verification.iat,
            exp: verification.exp
          };
        }
      }
    }

    // Continue regardless of token validity
    next();

  } catch (error) {
    // Log error but don't block the request
    console.error('Optional auth middleware error:', error);
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth
};