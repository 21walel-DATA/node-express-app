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
// TEST_PASSWORD is the password every pretend user has
const { loginAs, createUser, TEST_PASSWORD } = require('./loginHelper');

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

// ---------------------------------------------------------
// HELPERS FOR THE FORMS
// ---------------------------------------------------------

// Reads a user's saved name and email straight from the database
function getSaved(userId) {
  return db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);
}

// Tries to log in with an email and password. Gives back true if it worked
// (the login page answers a correct login with a redirect, 302).
async function canLogIn(email, password) {
  const response = await request(app).post('/login').type('form').send({ email, password });
  return response.status === 302;
}

// ---------------------------------------------------------
// 2. CHANGING NAME AND EMAIL
// ---------------------------------------------------------

test('changing only the name saves it, with no password needed', async () => {
  const agent = await loginAs(app, { name: 'Old Name', setupComplete: true });
  const { email } = getSaved(agent.user.id);

  const response = await agent
    .post('/account/details')
    .type('form')
    .send({ name: 'New Name', email });

  // Post/Redirect/Get: back to the Account page with a "saved" message
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/account?saved=details');
  assert.strictEqual(getSaved(agent.user.id).name, 'New Name');

  const page = await agent.get('/account?saved=details');
  assert.match(page.text, /Your details have been saved\./);
});

test('changing the email with the right current password saves it, and the new email works', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const { name } = getSaved(agent.user.id);

  const response = await agent.post('/account/details').type('form').send({
    name,
    email: 'brand-new@example.com',
    current_password: TEST_PASSWORD,
  });

  assert.strictEqual(response.status, 302);
  assert.strictEqual(getSaved(agent.user.id).email, 'brand-new@example.com');
  assert.ok(await canLogIn('brand-new@example.com', TEST_PASSWORD), 'the new email logs in');
});

test('changing the email with a wrong or missing current password is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const before = getSaved(agent.user.id);

  const wrong = await agent.post('/account/details').type('form').send({
    name: before.name,
    email: 'not-allowed@example.com',
    current_password: 'not-the-password',
  });
  const missing = await agent.post('/account/details').type('form').send({
    name: before.name,
    email: 'not-allowed@example.com',
  });

  // 400 is the HTTP status code for "Bad Request"
  assert.strictEqual(wrong.status, 400);
  assert.match(wrong.text, /To change your email, enter your current password\./);
  assert.strictEqual(missing.status, 400);
  assert.match(missing.text, /To change your email, enter your current password\./);
  assert.strictEqual(getSaved(agent.user.id).email, before.email);
});

test('an empty or too-long name is refused', async () => {
  const agent = await loginAs(app, { name: 'Kept Name', setupComplete: true });
  const { email } = getSaved(agent.user.id);

  const empty = await agent.post('/account/details').type('form').send({ name: '   ', email });
  const tooLong = await agent
    .post('/account/details')
    .type('form')
    .send({ name: 'n'.repeat(101), email });

  assert.strictEqual(empty.status, 400);
  assert.match(empty.text, /Enter your name\./);
  assert.strictEqual(tooLong.status, 400);
  assert.match(tooLong.text, /Your name must be 100 characters or fewer\./);
  assert.strictEqual(getSaved(agent.user.id).name, 'Kept Name');
});

test('a badly written email is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const before = getSaved(agent.user.id);

  const response = await agent.post('/account/details').type('form').send({
    name: before.name,
    email: 'not-an-email',
    current_password: TEST_PASSWORD,
  });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /Enter a valid email address\./);
  assert.strictEqual(getSaved(agent.user.id).email, before.email);
});

test('an email already used by another account is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  createUser({ email: 'taken@example.com', setupComplete: true });
  const before = getSaved(agent.user.id);

  const response = await agent.post('/account/details').type('form').send({
    name: before.name,
    email: 'TAKEN@example.com',
    current_password: TEST_PASSWORD,
  });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /An account with that email address already exists\./);
  assert.strictEqual(getSaved(agent.user.id).email, before.email);
});

test('a refused form keeps what was typed, but never the password', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.post('/account/details').type('form').send({
    name: 'Typed Name',
    email: 'typed@example.com',
    current_password: 'secret-typed-password',
  });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /<input[^>]*id="name"[^>]*value="Typed Name"/);
  assert.match(response.text, /<input[^>]*id="email"[^>]*value="typed@example\.com"/);
  assert.doesNotMatch(response.text, /secret-typed-password/);
});

test('only the logged-in user\'s details change, whatever id the form sends', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ name: 'Other Person', setupComplete: true });
  const { email } = getSaved(agent.user.id);

  await agent
    .post('/account/details')
    .type('form')
    .send({ name: 'Changed', email, user_id: other.id, id: other.id });

  assert.strictEqual(getSaved(other.id).name, 'Other Person');
  assert.strictEqual(getSaved(agent.user.id).name, 'Changed');
});

test('a logged-out visitor cannot change any details', async () => {
  const response = await request(app)
    .post('/account/details')
    .type('form')
    .send({ name: 'Nobody', email: 'nobody@example.com' });

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});
