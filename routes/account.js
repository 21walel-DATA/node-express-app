// routes/account.js
// Routes for feature 06, the Account page (see specs/06-account.md).
// The page, and saving name and email. Changing the password and deleting
// the account come in the next steps.

const express = require('express');
// bcryptjs checks a typed password against the scrambled (hashed) one
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------
// RULES
// ---------------------------------------------------------

// The SAME rules as registration (routes/auth.js, Walied's file). They are
// copied here so we did not have to edit his file during the sprint.
// If one changes there, change it here too.
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
// "something@something.something", with no spaces
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The "saved" messages, picked by the ?saved=... part of the address after a
// form is saved. Only these words are ever shown, never text from the
// address itself.
const SAVED_MESSAGES = {
  details: 'Your details have been saved.',
};

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

// Shows the Account page. Used for a normal visit and, in later steps,
// again when a form was refused.
//   errors   messages to show when a form was refused
//   values   what to put in the details boxes (name, email)
//   status   200 (OK) or 400 (Bad Request)
//   saved    a "saved" message to show, or '' for none
function renderAccount(res, { errors = [], values, status = 200, saved = '' } = {}) {
  // currentUser (from middleware/auth.js) leaves the email out on purpose,
  // so it is not carried around on every page. Read it here instead.
  const current = db
    .prepare('SELECT name, email FROM users WHERE id = ?')
    .get(res.locals.currentUser.id);

  res.status(status).render('account', {
    errors,
    // Normally the saved name and email
    values: values || current,
    saved,
  });
}

// Checks a typed password against the logged-in user's saved one.
// Gives back true or false. async because bcrypt takes a moment on purpose
// (that slowness makes guessing passwords much harder).
async function isCurrentPassword(userId, typedPassword) {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  return bcrypt.compare(typedPassword, user.password_hash);
}

// ---------------------------------------------------------
// ACCOUNT ROUTES
// ---------------------------------------------------------

// 1. ACCOUNT PAGE: the logged-in user's own settings.
// There is no id in the address: the page always belongs to the logged-in
// user, so nobody can open someone else's. app.js puts this router below
// the login check and the setup gate.
router.get('/account', (req, res) => {
  // ?saved=details picks a message from the list above. Anything else
  // (or nothing) shows no message.
  renderAccount(res, { saved: SAVED_MESSAGES[req.query.saved] || '' });
});

// 2. SAVE DETAILS: change name and email.
// Always saves to the LOGGED-IN user. Any id the form sends is ignored.
// async because checking a password with bcrypt takes a moment.
router.post('/account/details', async (req, res) => {
  const userId = res.locals.currentUser.id;

  // req.body is undefined if no form was sent, so "|| {}" avoids a crash.
  // trim() removes spaces at both ends. The password is NOT trimmed,
  // because a space can be a real part of a password.
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const currentPassword = String(body.current_password || '');

  // Collect every problem, so the person sees them all at once.
  // The messages are the same as on the Register page.
  const errors = [];

  if (name.length === 0) {
    errors.push('Enter your name.');
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.push(`Your name must be ${NAME_MAX_LENGTH} characters or fewer.`);
  }

  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    errors.push('Enter a valid email address.');
  }

  // Is the email actually changing? Emails ignore capital letters (the
  // email column is COLLATE NOCASE), so compare them in lower case.
  const savedEmail = db.prepare('SELECT email FROM users WHERE id = ?').get(userId).email;
  const emailIsChanging = email.toLowerCase() !== savedEmail.toLowerCase();

  // Only check a new email further when it is written correctly
  if (emailIsChanging && errors.length === 0) {
    // Not used by ANOTHER account ("id != ?" leaves the user out)
    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
    if (taken) {
      errors.push('An account with that email address already exists.');
    }

    // Decision 1: changing the email needs the current password, because
    // the email is how you log in
    if (!(await isCurrentPassword(userId, currentPassword))) {
      errors.push('To change your email, enter your current password.');
    }
  }

  // Refused: show the page again with the messages and what was typed.
  // 400 is the HTTP status code for "Bad Request". The password is never
  // sent back to the page.
  if (errors.length > 0) {
    return renderAccount(res, { errors, values: { name, email }, status: 400 });
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, userId);

  // Post/Redirect/Get: back to the page, with the "saved" message
  res.redirect('/account?saved=details');
});

// Share the router with app.js
module.exports = router;
