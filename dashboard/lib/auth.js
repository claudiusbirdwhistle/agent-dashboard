'use strict';

const TOKEN = process.env.DASHBOARD_TOKEN || '';

function auth(req, res, next) {
  if (!TOKEN) return next();
  const qToken = req.query.token;
  const hToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (qToken === TOKEN || hToken === TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized — provide ?token= or Authorization: Bearer header' });
}

module.exports = { auth, TOKEN };
