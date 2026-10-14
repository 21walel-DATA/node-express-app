// tests/login.test.js
// Tests for the login and logout routes in routes/auth.js.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');
const { loginAs, createUser, TEST_PASSWORD } = require('./loginHelper');

// Sends the login form the way a browser does
function login(email, password) {
  return request(app).post('/login').type('form').send({ email, password });
}

// Answers true when the sessions table holds a session for this user.
// Each row's data is JSON text, so it is parsed before looking inside.
function hasSession(userId) {
  const rows = db.prepare('SELECT data FROM sessions').all();
  return rows.some((row) => JSON.parse(row.data).userId === userId);
}

// ---------------------------------------------------------
// LOGIN
// ---------------------------------------------------------

// 1. NORMAL CASE: the login form is shown
test('GET /login shows the login form', async () => {
  const response = await request(app).get('/login');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Log in<\/h1>/);
});

// 2. NORMAL CASE: the right email and password log the user in
test('the correct password logs the user in', async () => {
  const user = createUser();

  const response = await login(user.email, TEST_PASSWORD);

  // Redirected to the home page, with a session saved for this user
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/');
  assert.strictEqual(hasSession(user.id), true);
});

// 3. NORMAL CASE: the email works in any letter case
test('the email is not case sensitive', async () => {
  const user = createUser({ email: 'mixed.case@example.com' });

  const response = await login('Mixed.Case@Example.com', TEST_PASSWORD);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(hasSession(user.id), true);
});

// 4. BAD INPUT: a wrong password is refused with a clear message
test('a wrong password is refused', async () => {
  const user = createUser();

  const response = await login(user.email, 'not-the-password');

  assert.strictEqual(response.status, 401);
  assert.match(response.text, /email address or password is incorrect/);
  // No session was created and no cookie was sent
  assert.strictEqual(hasSession(user.id), false);
  assert.strictEqual(response.headers['set-cookie'], undefined);
});

// 5. BAD INPUT: an unknown email gets the same message as a wrong password
test('an unknown email is refused with the same message', async () => {
  const response = await login('nobody@example.com', TEST_PASSWORD);

  assert.strictEqual(response.status, 401);
  assert.match(response.text, /email address or password is incorrect/);
});

// ---------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------

// 6. NORMAL CASE: logging out removes the session
test('logging out removes the session', async () => {
  const agent = await loginAs(app);
  assert.strictEqual(hasSession(agent.user.id), true);

  const response = await agent.post('/logout');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
  assert.strictEqual(hasSession(agent.user.id), false);
});

// ---------------------------------------------------------
// THE loginAs TEST HELPER
// ---------------------------------------------------------

// 7. The helper's options reach the database
test('loginAs creates the user it was asked for', async () => {
  const agent = await loginAs(app, {
    name: 'Ada Admin',
    isAdmin: true,
    setupComplete: true,
  });

  assert.strictEqual(agent.user.name, 'Ada Admin');
  assert.strictEqual(agent.user.is_admin, 1);
  assert.strictEqual(agent.user.setup_complete, 1);
  assert.strictEqual(hasSession(agent.user.id), true);
});
