const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { jwtSecret } = require('../config/env');

function auth(requiredRoles = []) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Login required' });

    try {
      const payload = jwt.verify(token, jwtSecret());
      if (requiredRoles.length && !requiredRoles.includes(payload.role)) {
        return res.status(403).json({ message: 'You do not have permission for this action' });
      }
      const account = await getAccountStatus(payload.id);
      if (account && account.account_status !== 'active') {
        return res.status(403).json({ message: 'Your account is not active. Please contact support.' });
      }
      req.user = payload;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Session expired. Please login again.' });
    }
  };
}

async function getAccountStatus(userId) {
  try {
    const [[user]] = await pool.query('SELECT account_status FROM users WHERE id = ? LIMIT 1', [userId]);
    return user || null;
  } catch (error) {
    if (error.code === 'ER_BAD_FIELD_ERROR') return null;
    throw error;
  }
}

module.exports = auth;
