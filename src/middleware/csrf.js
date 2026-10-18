const crypto = require('crypto');

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function tokensMatch(expected, actual) {
  if (typeof expected !== 'string' || typeof actual !== 'string') return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = createToken();
  res.locals.csrfToken = req.session.csrfToken;

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const submittedToken = req.body?._csrf || req.get('x-csrf-token');
  if (!tokensMatch(req.session.csrfToken, submittedToken)) {
    return res.status(403).render('error', {
      title: 'Forbidden',
      message: 'Your form session expired or the request was invalid. Please go back and try again.',
    });
  }

  next();
}

module.exports = csrfProtection;
