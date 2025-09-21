const mongoose = require('mongoose');

const authenticateUser = async (req, res, next) => {
  try {
    // Extract user ID from headers or JWT token
    const userId = req.headers['user-id'] || req.user?.id;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

module.exports = { authenticateUser };