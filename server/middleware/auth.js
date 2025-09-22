const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const authenticateUser = async (req, res, next) => {
  console.log('🔐 AUTH MIDDLEWARE CALLED!');
  console.log('🔐 Request path:', req.path);
  console.log('🔐 Request method:', req.method);
  
  try {
    let token = null;
    
    // 1. Try to get token from Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log('🔐 Token found in Authorization header');
    }
    
    // 2. If no Authorization header, try to get token from cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('🔐 Token found in cookies');
    }
    
    // 3. If still no token, try other cookie names
    if (!token && req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
      console.log('🔐 Token found in jwt cookie');
    }
    
    console.log('🔐 Final token:', token ? token.substring(0, 20) + '...' : 'NONE');
    
    if (!token) {
      console.log('❌ No token found in Authorization header or cookies');
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    // 4. Verify the JWT token
    console.log('🔐 Verifying token with secret...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified successfully:', {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      exp: new Date(decoded.exp * 1000)
    });

    // 5. Get user ID from token or fallback to header
    const userId = decoded.userId || decoded.id || req.headers['user-id'];
    
    if (!userId) {
      console.log('❌ No user ID found in token or headers');
      return res.status(401).json({
        error: 'Access denied. User ID not found.',
        code: 'NO_USER_ID'
      });
    }

    // 6. Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('❌ Invalid user ID format:', userId);
      return res.status(401).json({
        error: 'Invalid user ID format',
        code: 'INVALID_USER_ID'
      });
    }

    console.log('✅ User authenticated:', userId);

    // 7. Add user info to request object
    req.userId = userId;
    req.user = decoded;
    req.token = token;
    
    console.log('✅ Auth middleware completed successfully');
    next();

  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      console.log('❌ Invalid JWT token');
      return res.status(401).json({
        error: 'Access denied. Invalid token.',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      console.log('❌ JWT token expired');
      return res.status(401).json({
        error: 'Access denied. Token expired.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.log('❌ General auth error:', error);
    return res.status(500).json({
      error: 'Internal server error during authentication.',
      code: 'AUTH_ERROR'
    });
  }
};

module.exports = { authenticateUser };