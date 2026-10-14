// tests/admin-users.test.js
// Tests for the admin users pages in routes/admin.js: listing accounts and
// removing one.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');
// loginAs gives us a pretend user who is already logged in.
// createUser adds a user without logging them in.
const { loginAs, createUser, TEST_PASSWORD } = require('./loginHelper');
const { findMatches } = require('../matching');

// Finds a user row by id, or undefined when there is none
function findUser(id) {
  return db.prepare('SELECT id FROM users WHERE id = ?').get(id);
}

// ---------------------------------------------------------
// LISTING ACCOUNTS
// ---------------------------------------------------------

// 1. NORMAL CASE: the users page lists accounts with a Remove link
test('the users page lists accounts, with Remove links', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const student = createUser({ name: 'Listed Student' });

  const response = await admin.get('/admin/users');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /Listed Student/);
  assert.match(response.text, new RegExp(`href="/admin/users/${student.id}/remove"`));
});

// 2. EDGE CASE: there is no Remove link on the admin's own row
test('the users page has no Remove link for the admin themselves', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  const response = await admin.get('/admin/users');

  assert.doesNotMatch(response.text, new RegExp(`/admin/users/${admin.user.id}/remove`));
});

// 3. NORMAL CASE: the Remove link opens an "are you sure?" page, which
// changes nothing by itself
test('the remove link asks for confirmation first', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const student = createUser({ name: 'Careful Carla' });

  const response = await admin.get(`/admin/users/${student.id}/remove`);

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /Remove Careful Carla's account\?/);
  // Opening the page did not remove anyone
  assert.ok(findUser(student.id));
});

// ---------------------------------------------------------
// REMOVING AN ACCOUNT (finish line)
// ---------------------------------------------------------

// 4. NORMAL CASE (finish line): a removed user cannot log in
test('a removed user cannot log in', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const student = createUser();

  const response = await admin.post(`/admin/users/${student.id}/remove`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/admin/users');
  assert.strictEqual(findUser(student.id), undefined);

  // Try to log in with their old details: refused like any wrong login
  const login = await request(app)
    .post('/login')
    .type('form')
    .send({ email: student.email, password: TEST_PASSWORD });
  assert.strictEqual(login.status, 401);
});

// 5. NORMAL CASE (finish line): a removed user no longer appears in matches
test('a removed user no longer appears in matches', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  // Two students who match: both want to meet people socially
  const optionId = db.prepare("SELECT id FROM looking_for_options WHERE code = 'social'").get().id;
  const viewer = createUser({ setupComplete: true });
  const removed = createUser({ name: 'Gone Gwen', setupComplete: true });
  for (const user of [viewer, removed]) {
    db.prepare('INSERT INTO user_looking_for (user_id, option_id) VALUES (?, ?)').run(user.id, optionId);
  }
  // Check they really match before the removal, so the test proves something
  assert.ok(findMatches(viewer.id).some((match) => match.id === removed.id));

  await admin.post(`/admin/users/${removed.id}/remove`);

  assert.ok(!findMatches(viewer.id).some((match) => match.id === removed.id));
});

// 6. NORMAL CASE: a removed user who is logged in is logged out
test('a removed user who is logged in is logged out at once', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const student = await loginAs(app, { setupComplete: true });

  await admin.post(`/admin/users/${student.user.id}/remove`);

  // Their browser still has the old cookie, but it no longer works
  const response = await student.get('/');
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// ---------------------------------------------------------
// REFUSED REMOVALS
// ---------------------------------------------------------

// 7. DENIED ACTION: an admin cannot remove their own account here
test('an admin cannot remove their own account', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  const response = await admin.post(`/admin/users/${admin.user.id}/remove`);

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /You cannot remove your own account here/);
  assert.ok(findUser(admin.user.id));
});

// 8. EDGE CASE: removing an account that does not exist gives 404
test('removing an account that does not exist gives 404', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  const confirm = await admin.get('/admin/users/99999/remove');
  const remove = await admin.post('/admin/users/99999/remove');

  assert.strictEqual(confirm.status, 404);
  assert.strictEqual(remove.status, 404);
  assert.match(remove.text, /That account no longer exists/);
});

// 9. DENIED ACCESS: a student cannot see the users page or remove anyone
test('a student cannot see the users page or remove an account', async () => {
  const student = await loginAs(app, { setupComplete: true });
  const other = createUser();

  const page = await student.get('/admin/users');
  const remove = await student.post(`/admin/users/${other.id}/remove`);

  assert.strictEqual(page.status, 403);
  assert.strictEqual(remove.status, 403);
  assert.ok(findUser(other.id));
});
