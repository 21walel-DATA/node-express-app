// tests/profile-empty-lists.test.js
// The profile form when an admin has not added any skills or interests yet
// (the spec's "no results" case).
// This is its own file because it needs an EMPTY database. Each test file
// runs on its own with a fresh in-memory database, so nothing added in
// profile.test.js can leak in here.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const { loginAs } = require('./loginHelper');

// 1. NO RESULTS: empty lists show a clear message instead of nothing
test('the profile form explains when there are no skills or interests', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/profile/edit');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /No skills to choose from yet\. Please ask an admin\./);
  assert.match(response.text, /No interests to choose from yet\. Please ask an admin\./);
  // The "looking for" options are fixed (schema.sql adds them), so they
  // are still there
  assert.match(response.text, /Co-founder \/ business partner/);
});
