const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { redirectIfAuthed } = require('../middleware/auth');
const { setFlash } = require('../middleware/flash');

const router = express.Router();

function setUserSession(req, user) {
  req.session = {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
    },
  };
}

router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('login', { title: 'Login' });
});

router.post('/login', async (req, res, next) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  try {
    const { rows } = await query('SELECT * FROM users WHERE username = $1 AND active = TRUE', [username]);
    const user = rows[0];

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      setFlash(req, 'error', 'Invalid username or password.');
      return res.redirect('/login');
    }

    setUserSession(req, user);

    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/pos');
  } catch (err) {
    next(err);
  }
});

router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('register', {
    title: 'Register',
    adminSignupEnabled: Boolean(process.env.ADMIN_SIGNUP_CODE),
  });
});

router.post('/register', async (req, res, next) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  const fullName = typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const confirmPassword = typeof req.body.confirm_password === 'string' ? req.body.confirm_password : '';
  const role = req.body.role;
  const adminCode = typeof req.body.admin_code === 'string' ? req.body.admin_code : '';

  try {
    if (!username || !fullName || !password) {
      setFlash(req, 'error', 'Please fill in all required fields.');
      return res.redirect('/register');
    }
    if (!/^[a-z0-9][a-z0-9._-]{2,49}$/.test(username)) {
      setFlash(req, 'error', 'Username must be 3-50 characters and use only letters, numbers, dots, underscores, or hyphens.');
      return res.redirect('/register');
    }
    if (fullName.length > 100) {
      setFlash(req, 'error', 'Full name must be 100 characters or fewer.');
      return res.redirect('/register');
    }
    if (password.length < 6 || password.length > 72) {
      setFlash(req, 'error', 'Password must be between 6 and 72 characters.');
      return res.redirect('/register');
    }
    if (password !== confirmPassword) {
      setFlash(req, 'error', 'Passwords do not match.');
      return res.redirect('/register');
    }

    let finalRole = 'sales_rep';
    if (role === 'admin') {
      const signupCode = process.env.ADMIN_SIGNUP_CODE;
      if (!signupCode || adminCode !== signupCode) {
        setFlash(req, 'error', 'Incorrect (or disabled) admin setup code.');
        return res.redirect('/register');
      }
      finalRole = 'admin';
    }

    const { rows: existing } = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.length) {
      setFlash(req, 'error', 'That username is already taken.');
      return res.redirect('/register');
    }
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role',
      [username, hash, fullName, finalRole]
    );
    const user = rows[0];

    setUserSession(req, user);
    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/pos');
  } catch (err) {
    if (err.code === '23505') {
      setFlash(req, 'error', 'That username is already taken.');
      return res.redirect('/register');
    }
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

module.exports = router;
