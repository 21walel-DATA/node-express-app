// tests/admin.test.js
// Tests for the admin pages in routes/admin.js, and the admin check
// (requireAdmin) in middleware/auth.js.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
// loginAs gives us a pretend user who is already logged in.
// { isAdmin: true } makes that user an admin.
const { loginAs } = require('./loginHelper');

// ---------------------------------------------------------
// WHO CAN OPEN THE ADMIN PAGES
// ---------------------------------------------------------

// 1. NORMAL CASE: an admin can open the admin home page
test('an admin can open /admin', async () => {
  const agent = await loginAs(app, { isAdmin: true });

  const response = await agent.get('/admin');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Admin<\/h1>/);
});

// 2. DENIED ACCESS (finish line): a student who opens an admin page is refused
test('a non-admin who opens /admin is refused with 403', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/admin');

  // 403 is the HTTP status code for "Forbidden"
  assert.strictEqual(response.status, 403);
  assert.match(response.text, /Not allowed/);
  // Make sure the admin page itself was not sent
  assert.doesNotMatch(response.text, /<h1>Admin<\/h1>/);
});

// 3. DENIED ACCESS: the check covers every address under /admin, even ones
// with no page yet, so a student cannot find out which admin pages exist
test('a non-admin is refused at any address under /admin', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/admin/some/future/page');

  assert.strictEqual(response.status, 403);
});

// 4. DENIED ACCESS: a logged-out visitor is sent to the login page first
test('a logged-out visitor to /admin is sent to the login page', async () => {
  const response = await request(app).get('/admin');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// ---------------------------------------------------------
// HEADER LINK
// ---------------------------------------------------------

// 5. NORMAL CASE: admins see an "Admin" link in the header
test('the header shows an Admin link to admins', async () => {
  const agent = await loginAs(app, { isAdmin: true });

  const response = await agent.get('/admin');

  assert.match(response.text, /<a href="\/admin">Admin<\/a>/);
});

// 6. EDGE CASE: students do not see the Admin link
test('the header does not show the Admin link to students', async () => {
  // setupComplete: true gets the student past the profile setup gate, so
  // they really reach the dashboard (otherwise they are redirected to the
  // profile form, and the check below would pass without proving anything)
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/');

  // Check the dashboard really loaded before checking what is missing from it
  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /href="\/admin"/);
});
