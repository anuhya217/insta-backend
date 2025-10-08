const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), 'secret');
    req.user = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};
