// tests/home.test.js
// Tests for the home page route in routes/home.js.
// Run all tests with: npm test

// test: Node's built-in function for defining one test
const test = require('node:test');
// assert: Node's built-in checks. If a check fails, the test fails.
const assert = require('node:assert');
// request: supertest sends a pretend HTTP request straight to the app
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');

// ---------------------------------------------------------
// HOME PAGE
// ---------------------------------------------------------

// 1. NORMAL CASE: the home page answers and says the app is running
test('GET / says the app is running', async () => {
  // Ask the app for the home page and wait for the answer
  const response = await request(app).get('/');

  // 200 is the HTTP status code for "OK"
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.message, 'Bootcamp Connect is running');
});

// 2. DENIED ACCESS: the old open practice routes must stay removed
test('GET /api/users is not available', async () => {
  const response = await request(app).get('/api/users');

  // 404 is the HTTP status code for "Not Found"
  assert.strictEqual(response.status, 404);
});
