const jwt = require('jsonwebtoken');

const generateAuthToken = (userId) => {
  // Check if JWT_SECRET exists in environment variables
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  // Create payload with user ID and timestamp
  const payload = {
    userId: userId,
    iat: Math.floor(Date.now() / 1000) // issued at time
  };

  // Generate token with expiration
  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: '7d', // Token expires in 7 days
      issuer: 'personalos-auth'
    }
  );

  return token;
};

// Function to verify and decode token
const verifyAuthToken = (token) => {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      isValid: true,
      userId: decoded.userId,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
};

// Function to extract user ID from token
const getUserIdFromToken = (token) => {
  const verification = verifyAuthToken(token);
  return verification.isValid ? verification.userId : null;
};

module.exports = {
  generateAuthToken,
  verifyAuthToken,
  getUserIdFromToken
};