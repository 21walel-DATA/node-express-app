// scripts/create-admin.js
// Creates the first admin account (PRD section 4.5: "the first admin is
// created by a setup script run by us, never through the website").
//
// The details come from environment variables, not from typed arguments,
// so the password does not end up in the terminal's history. In PowerShell:
//   $env:ADMIN_EMAIL='me@example.com'; $env:ADMIN_PASSWORD='pick-something'; npm run create-admin
// ADMIN_NAME is optional and defaults to 'Admin'.
//
// On Railway, set the same variables in the Variables tab and redeploy:
// index.js runs this at startup when they are set (createAdminOnStartup).
// Then REMOVE them, so the password is not left sitting in the settings.
//
// It is safe to run more than once. If the email already has an account,
// that account is made an admin instead of a second account being created.

const bcrypt = require('bcryptjs');
const db = require('../db');

// ---------------------------------------------------------
// 1. SETTINGS
// ---------------------------------------------------------

// The same password rules and bcrypt setting as the registration form in
// routes/auth.js, so an admin password is never weaker than a student's
const BCRYPT_ROUNDS = 10;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

// ---------------------------------------------------------
// 2. CREATE THE ADMIN
// ---------------------------------------------------------

// Creates an admin, or makes an existing account an admin.
// details is { name, email, password }. name is optional.
// Returns 'created' or 'promoted', so the caller can say what happened.
// Throws an error with a clear message if a detail is missing or too weak.
function createAdmin(details) {
  // "|| ''" turns a missing value into empty text, so .trim() always works.
  // trim() removes spaces typed by accident at the start or end.
  const name = (details.name || 'Admin').trim();
  const email = (details.email || '').trim();
  const password = details.password || '';

  // 2a. Check the details. "throw" stops the function and hands the error
  // to whoever called it.
  if (!email) {
    throw new Error('ADMIN_EMAIL is not set.');
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`
    );
  }

  // 2b. Does this email already have an account? (The email column ignores
  // upper and lower case, so Me@x.com finds me@x.com.)
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existing) {
    // Make that account an admin. Its password is left as it was: this
    // script never changes the password of an account that already exists.
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
    return 'promoted';
  }

  // 2c. A new account. The password is stored hashed, never as plain text.
  const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  // Notes on the values:
  // - course_id is left empty: admins are organisers, not on a course.
  // - setup_complete is 1: admins never fill in a student profile, so the
  //   profile setup gate (feature 02) must not stop them. Admins are still
  //   left out of matches, because findMatches skips is_admin = 1.
  // - privacy_agreed_at must be filled in, so it is set to the time the
  //   admin was created.
  db.prepare(
    `INSERT INTO users
       (name, email, password_hash, is_admin, setup_complete, privacy_agreed_at)
     VALUES (?, ?, ?, 1, 1, CURRENT_TIMESTAMP)`
  ).run(name, email, passwordHash);

  return 'created';
}

// ---------------------------------------------------------
// 3. CREATE THE ADMIN AT STARTUP
// ---------------------------------------------------------

// index.js calls this as the app starts, which is how the first admin
// reaches Railway. It does nothing unless BOTH ADMIN_EMAIL and
// ADMIN_PASSWORD are set.
// env is the list of environment variables, usually process.env. Tests
// pass their own list instead.
// Returns 'created', 'promoted', or null when it did nothing.
function createAdminOnStartup(env) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return null;
  }

  return createAdmin({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  });
}

// ---------------------------------------------------------
// 4. RUNNING THE SCRIPT
// ---------------------------------------------------------

// This is true only when the file is run directly (npm run create-admin).
// When a test loads the file with require, nothing runs on its own.
if (require.main === module) {
  // try/catch: if createAdmin throws an error, the code jumps to "catch"
  // instead of crashing with a long error report
  try {
    const result = createAdmin({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log(`Admin ${result}: ${process.env.ADMIN_EMAIL}`);
  } catch (error) {
    console.error(`Could not create the admin: ${error.message}`);
    // A non-zero exit code tells the terminal the script failed
    process.exitCode = 1;
  }
}

// Share the functions with index.js and the tests
module.exports = { createAdmin, createAdminOnStartup };
