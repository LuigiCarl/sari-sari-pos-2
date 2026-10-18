const { query } = require('../config/db');

async function refreshAuthenticatedUser(req, res, next) {
  if (!req.session.user) return next();

  try {
    const { rows } = await query(
      'SELECT id, username, full_name, role, active FROM users WHERE id = $1',
      [req.session.user.id]
    );
    const user = rows[0];

    if (!user || !user.active) {
      req.session = null;
      return res.redirect('/login');
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (req.session.user.role !== role) {
      return res.status(403).render('error', {
        title: 'Forbidden',
        message: 'You do not have permission to view this page.',
      });
    }
    next();
  };
}

function redirectIfAuthed(req, res, next) {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin/dashboard' : '/pos');
  }
  next();
}

module.exports = { refreshAuthenticatedUser, requireAuth, requireRole, redirectIfAuthed };
