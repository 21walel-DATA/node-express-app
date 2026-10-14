// tests/account.test.js
// Tests for feature 06, the Account page (specs/06-account.md).
// The groups, in order: showing the page, changing details, changing the
// password, and deleting the account.
// Run all tests with: npm test

// test: Node's built-in function for defining one test
const test = require('node:test');
// assert: Node's built-in checks. If a check fails, the test fails.
const assert = require('node:assert');
// request: supertest sends a pretend HTTP request straight to the app
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');
// loginAs gives us a pretend user who is already logged in.
// createUser adds a user without logging them in.
const { loginAs, createUser } = require('./loginHelper');

// ---------------------------------------------------------
// 1. SHOWING THE ACCOUNT PAGE
// ---------------------------------------------------------

test('the Account page shows your name and email, filled in', async () => {
  const agent = await loginAs(app, {
    name: 'Amira Account',
    email: 'amira@example.com',
    setupComplete: true,
  });

  const response = await agent.get('/account');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Account settings<\/h1>/);
  // The boxes start with the saved values in them
  assert.match(response.text, /<input[^>]*id="name"[^>]*value="Amira Account"/);
  assert.match(response.text, /<input[^>]*id="email"[^>]*value="amira@example\.com"/);
  // The details form saves to /account/details
  assert.match(response.text, /<form method="post" action="\/account\/details"/);
});

test('your own profile links to the Account page', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get(`/profile/${agent.user.id}`);

  assert.match(response.text, /<a href="\/account">Account settings<\/a>/);
});

test('someone else\'s profile has no link to the Account page', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });

  const response = await agent.get(`/profile/${other.id}`);

  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /Account settings/);
});

test('a logged-out visitor cannot see the Account page', async () => {
  const response = await request(app).get('/account');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

test('a user who has not finished setup is sent to the profile form', async () => {
  // Decision 4: the setup gate still covers the Account page
  const agent = await loginAs(app, { setupComplete: false });

  const response = await agent.get('/account');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/profile/edit');
});
