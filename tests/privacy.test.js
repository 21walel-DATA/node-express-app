// tests/privacy.test.js
// Tests for the privacy notice route in routes/privacy.js.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');

// ---------------------------------------------------------
// PRIVACY NOTICE
// ---------------------------------------------------------

// 1. NORMAL CASE: a visitor who is not logged in can read the notice
test('GET /privacy shows the privacy notice without logging in', async () => {
  // request(app) sends no cookie, so this visitor is logged out
  const response = await request(app).get('/privacy');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Privacy notice<\/h1>/);
});

// 2. NORMAL CASE: every page links to the notice from its footer
test('the footer links to the privacy notice', async () => {
  const response = await request(app).get('/privacy');

  assert.match(response.text, /href="\/privacy"/);
});
