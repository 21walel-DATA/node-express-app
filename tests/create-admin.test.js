// tests/create-admin.test.js
// Tests for the first-admin script in scripts/create-admin.js.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');
const { createUser } = require('./loginHelper');
const { createAdmin, createAdminOnStartup } = require('../scripts/create-admin');

// Finds a user row by email, or undefined when there is none
function findUser(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

// Counts the users with this email (to check no copies are made)
function countUsers(email) {
  return db.prepare('SELECT COUNT(*) AS total FROM users WHERE email = ?').get(email).total;
}

// ---------------------------------------------------------
// CREATING THE ADMIN
// ---------------------------------------------------------

// 1. NORMAL CASE: a new admin is created, with a hashed password that works
test('createAdmin creates an admin who can log in', async () => {
  const result = createAdmin({ name: 'Olu Organiser', email: 'olu@example.com', password: 'admin-pass-1' });

  assert.strictEqual(result, 'created');

  const admin = findUser('olu@example.com');
  assert.strictEqual(admin.name, 'Olu Organiser');
  assert.strictEqual(admin.is_admin, 1);
  // Admins skip the student profile setup, so the setup gate never stops them
  assert.strictEqual(admin.setup_complete, 1);
  // The password is stored hashed, never as plain text
  assert.notStrictEqual(admin.password_hash, 'admin-pass-1');
  assert.strictEqual(bcrypt.compareSync('admin-pass-1', admin.password_hash), true);

  // And the admin can really log in through the login form, and open /admin
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email: 'olu@example.com', password: 'admin-pass-1' });
  const response = await agent.get('/admin');
  assert.strictEqual(response.status, 200);
});

// 2. NORMAL CASE: the name is optional and defaults to 'Admin'
test('createAdmin uses the name "Admin" when none is given', () => {
  createAdmin({ email: 'noname@example.com', password: 'admin-pass-1' });

  assert.strictEqual(findUser('noname@example.com').name, 'Admin');
});

// 3. EDGE CASE: running it twice does not make a copy
test('running createAdmin twice does not create a second account', () => {
  createAdmin({ email: 'twice@example.com', password: 'admin-pass-1' });
  const second = createAdmin({ email: 'twice@example.com', password: 'admin-pass-1' });

  assert.strictEqual(second, 'promoted');
  assert.strictEqual(countUsers('twice@example.com'), 1);
});

// 4. NORMAL CASE: an existing student account is made an admin, and its
// password is left alone
test('createAdmin makes an existing account an admin without changing its password', () => {
  const student = createUser({ email: 'existing@example.com' });

  const result = createAdmin({ email: 'existing@example.com', password: 'a-different-password' });

  assert.strictEqual(result, 'promoted');
  const updated = findUser('existing@example.com');
  assert.strictEqual(updated.is_admin, 1);
  assert.strictEqual(updated.password_hash, student.password_hash);
});

// 5. INVALID INPUT: a missing email is refused
test('createAdmin refuses a missing email', () => {
  // assert.throws passes only if the function throws an error whose
  // message matches
  assert.throws(() => createAdmin({ password: 'admin-pass-1' }), /ADMIN_EMAIL is not set/);
});

// 6. INVALID INPUT: a password that is too short (or missing) is refused,
// and no account is created
test('createAdmin refuses a password shorter than 8 characters', () => {
  assert.throws(
    () => createAdmin({ email: 'short@example.com', password: 'short' }),
    /must be 8 to 72 characters/
  );
  assert.throws(() => createAdmin({ email: 'short@example.com' }), /must be 8 to 72 characters/);

  assert.strictEqual(findUser('short@example.com'), undefined);
});

// ---------------------------------------------------------
// AT STARTUP
// ---------------------------------------------------------

// 7. NORMAL CASE: at startup, nothing happens unless BOTH variables are set
test('createAdminOnStartup does nothing unless ADMIN_EMAIL and ADMIN_PASSWORD are set', () => {
  // Each { } is a pretend list of environment variables
  assert.strictEqual(createAdminOnStartup({}), null);
  assert.strictEqual(createAdminOnStartup({ ADMIN_EMAIL: 'half@example.com' }), null);
  assert.strictEqual(createAdminOnStartup({ ADMIN_PASSWORD: 'admin-pass-1' }), null);

  assert.strictEqual(findUser('half@example.com'), undefined);
});

// 8. NORMAL CASE: at startup, with both variables set, the admin is created
test('createAdminOnStartup creates the admin when both variables are set', () => {
  const result = createAdminOnStartup({
    ADMIN_NAME: 'Startup Admin',
    ADMIN_EMAIL: 'startup@example.com',
    ADMIN_PASSWORD: 'admin-pass-1',
  });

  assert.strictEqual(result, 'created');
  assert.strictEqual(findUser('startup@example.com').is_admin, 1);
});
