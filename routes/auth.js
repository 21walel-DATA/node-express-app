// routes/auth.js
// Routes for registering an account. Login and logout will be added here
// next. "auth" is short for authentication: proving who somebody is.

const express = require('express');
// bcryptjs scrambles (hashes) passwords so the real one is never stored
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

// How much work bcrypt does for each password. A higher number is slower,
// which makes guessing passwords slower for an attacker too. 10 is the
// usual default.
const BCRYPT_ROUNDS = 10;

// Limits for the registration form
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
// bcrypt only looks at the first 72 characters of a password, so we do not
// accept longer ones (the extra characters would silently be ignored)
const PASSWORD_MAX_LENGTH = 72;

// A simple shape check for an email address: something@something.something
// with no spaces. It does not prove the address is real.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shows the registration form. It is used for the first visit and again
// when the form comes back with mistakes.
//   errors: a list of messages to show at the top of the form
//   values: what the person typed, so they do not have to type it again
function renderRegisterForm(res, errors, values) {
  // The course dropdown is filled from the database, so a course added by
  // an admin appears here automatically
  const courses = db.prepare('SELECT id, name FROM courses ORDER BY name').all();

  res.render('register', { courses, errors, values });
}

// ---------------------------------------------------------
// REGISTRATION ROUTES
// ---------------------------------------------------------

// 1. REGISTER FORM: Show an empty registration form.
router.get('/register', (req, res) => {
  renderRegisterForm(res, [], {});
});

// 2. REGISTER: Check the form, create the account and log the new user in.
// "async" lets us use "await" inside, to wait for the password hashing.
// "next" is a function Express gives every route. Calling next(err) hands
// an error to Express, which then shows its error page.
router.post('/register', async (req, res, next) => {
  // req.body holds the form fields. It is undefined if no form was sent,
  // so fall back to an empty object to avoid a crash.
  const body = req.body || {};

  // String(... || '') turns a missing field into empty text.
  // trim() removes spaces from both ends. The password is NOT trimmed,
  // because a space can be a real part of a password.
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  // Number() turns the text "2" into the number 2
  const courseId = Number(body.course_id);
  // An unticked checkbox is not sent at all, so this is true only if ticked
  const agreedToPrivacy = body.privacy === 'yes';

  // Collect every problem, so the person sees them all at once
  const errors = [];

  if (name === '') {
    errors.push('Enter your name.');
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.push(`Your name must be ${NAME_MAX_LENGTH} characters or fewer.`);
  }

  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) {
    errors.push('Enter a valid email address.');
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Your password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Your password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
  }

  // The course must be one that really exists in the database.
  // Never trust that the browser only sends values from the dropdown.
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) {
    errors.push('Choose your course.');
  }

  if (!agreedToPrivacy) {
    errors.push('You must agree to the privacy notice to register.');
  }

  // Only look for a duplicate when the email itself is acceptable.
  // The email column is COLLATE NOCASE, so Sam@x.com matches sam@x.com.
  if (errors.length === 0) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      errors.push('An account with that email address already exists.');
    }
  }

  // If anything was wrong, show the form again with the messages.
  // 400 is the HTTP status code for "Bad Request".
  // The password is deliberately not sent back to the page.
  if (errors.length > 0) {
    res.status(400);
    return renderRegisterForm(res, errors, { name, email, courseId });
  }

  // Scramble the password. The hash cannot be turned back into the password.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Save the new user. The ? placeholders keep the typed values separate
  // from the SQL, which prevents SQL injection.
  // toISOString() gives the date and time as text, e.g. 2026-10-13T15:04:05.000Z
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, course_id, privacy_agreed_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, email, passwordHash, courseId, new Date().toISOString());

  // Log the new user in. regenerate() throws away the old session and
  // starts a fresh one with a new id. Doing this at every login stops an
  // attacker from reusing a session id they planted earlier.
  req.session.regenerate((err) => {
    if (err) {
      return next(err);
    }

    // Remember who is logged in. lastInsertRowid is the new user's id.
    req.session.userId = Number(result.lastInsertRowid);

    // Send the browser to the home page (the dashboard, once it exists)
    res.redirect('/');
  });
});

// Share the router with app.js
module.exports = router;
