// routes/auth.js
// Routes for registering an account, logging in and logging out.
// "auth" is short for authentication: proving who somebody is.

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

// ---------------------------------------------------------
// LOGIN AND LOGOUT ROUTES
// ---------------------------------------------------------

// The same message is used for an unknown email and for a wrong password.
// Saying which one was wrong would tell a stranger which email addresses
// have an account here.
const LOGIN_ERROR = 'The email address or password is incorrect.';

// 3. LOGIN FORM: Show an empty login form.
router.get('/login', (req, res) => {
  res.render('login', { errors: [], values: {} });
});

// 4. LOGIN: Check the email and password, then remember the user.
router.post('/login', async (req, res, next) => {
  const body = req.body || {};
  const email = String(body.email || '').trim();
  const password = String(body.password || '');

  // Look the user up by email. The column is COLLATE NOCASE, so the
  // letter case of what was typed does not matter.
  const user = db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .get(email);

  // bcrypt.compare hashes the typed password the same way and checks it
  // against the stored hash. It answers true or false.
  // "user &&" skips the check when no user was found.
  const passwordMatches =
    user && (await bcrypt.compare(password, user.password_hash));

  // 401 is the HTTP status code for "Unauthorized": we do not know who
  // this is. The email is sent back to refill the form; the password is not.
  if (!passwordMatches) {
    res.status(401);
    return res.render('login', { errors: [LOGIN_ERROR], values: { email } });
  }

  // Start a fresh session, exactly as registration does
  req.session.regenerate((err) => {
    if (err) {
      return next(err);
    }

    req.session.userId = user.id;
    res.redirect('/');
  });
});

// 5. LOGOUT: Forget the user.
// This is a POST, not a GET, because it changes something. A GET can be
// triggered just by loading a link or an image, so another website could
// log people out without them clicking anything.
router.post('/logout', (req, res, next) => {
  // destroy() deletes the session's row from the database
  // (it calls destroy in sessionStore.js)
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    // Tell the browser to throw away the session cookie as well.
    // connect.sid is the name express-session gives its cookie.
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// Share the router with app.js
module.exports = router;
