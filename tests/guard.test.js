// tests/guard.test.js
// Tests for the login check in middleware/auth.js: who may open which page.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');
const { loginAs } = require('./loginHelper');

// ---------------------------------------------------------
// LOGGED-OUT VISITORS
// ---------------------------------------------------------

// 1. DENIED ACCESS: a logged-out visitor is sent to the login page
test('a logged-out visitor to / is sent to the login page', async () => {
  // request(app) sends no cookie, so this visitor is logged out
  const response = await request(app).get('/');

  // 302 is a redirect; the location header says where to
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// 2. DENIED ACCESS: the check covers every address, even ones with no page,
// so a logged-out visitor cannot find out which pages exist
test('a logged-out visitor to any other address is sent to the login page', async () => {
  const response = await request(app).get('/some/page/that/does/not/exist');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// 3. NORMAL CASE: the three public pages open without logging in
test('register, login and the privacy notice are open to everyone', async () => {
  // Check each public address in turn
  for (const address of ['/register', '/login', '/privacy']) {
    const response = await request(app).get(address);

    assert.strictEqual(response.status, 200, `${address} should be public`);
  }
});

// 4. NORMAL CASE: a logged-out visitor is offered Log in and Register
test('the header shows Log in and Register to a logged-out visitor', async () => {
  const response = await request(app).get('/login');

  assert.match(response.text, /<a href="\/login">Log in<\/a>/);
  assert.match(response.text, /<a href="\/register">Register<\/a>/);
  assert.doesNotMatch(response.text, /Log out/);
});

// ---------------------------------------------------------
// LOGGED-IN USERS
// ---------------------------------------------------------

// 5. NORMAL CASE: a logged-in user sees their name and a Log out button
test('the header shows the name and Log out to a logged-in user', async () => {
  const agent = await loginAs(app, { name: 'Sam Taylor', setupComplete: true });

  const response = await agent.get('/');

  assert.match(response.text, /Sam Taylor/);
  assert.match(response.text, /Log out/);
});

// 6. DENIED ACCESS: after logging out, the same browser is refused again
test('after logging out, the user is sent to the login page', async () => {
  const agent = await loginAs(app);
  await agent.post('/logout');

  const response = await agent.get('/');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// 7. DENIED ACCESS: deleting an account also ends its logged-in sessions
test('a user whose account was deleted is no longer logged in', async () => {
  const agent = await loginAs(app);

  // Remove the account while the browser still holds its session cookie
  db.prepare('DELETE FROM users WHERE id = ?').run(agent.user.id);

  const response = await agent.get('/');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});
