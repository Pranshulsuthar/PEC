const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Verify JWT and attach user info to req.user
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET || 'change_this_to_a_secure_secret', (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    // Attach user info
    req.user = decoded;
    next();
  });
}

module.exports = { verifyToken };
