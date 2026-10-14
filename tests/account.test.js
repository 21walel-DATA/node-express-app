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

// ---------------------------------------------------------
// 3. CHANGING THE PASSWORD
// ---------------------------------------------------------

// Sends the change-password form for a logged-in agent
function changePassword(agent, fields) {
  return agent.post('/account/password').type('form').send(fields);
}

test('the Account page has a labelled change-password form', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/account');

  assert.match(response.text, /<form method="post" action="\/account\/password"/);
  assert.match(response.text, /<label for="current_password">Current password<\/label>/);
  assert.match(response.text, /<label for="new_password">New password<\/label>/);
  assert.match(response.text, /<label for="new_password_again">Type the new password again<\/label>/);
});

test('changing the password works at the next login, and the old one stops working', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const { email } = getSaved(agent.user.id);

  const response = await changePassword(agent, {
    current_password: TEST_PASSWORD,
    new_password: 'a-brand-new-password',
    new_password_again: 'a-brand-new-password',
  });

  // Post/Redirect/Get: back to the Account page with a "saved" message
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/account?saved=password');
  const page = await agent.get('/account?saved=password');
  assert.match(page.text, /Your password has been changed\./);

  // Still logged in: the page loaded (200), not a redirect to login
  assert.strictEqual(page.status, 200);

  assert.ok(await canLogIn(email, 'a-brand-new-password'), 'the new password logs in');
  assert.ok(!(await canLogIn(email, TEST_PASSWORD)), 'the old password no longer logs in');
});

test('a wrong current password is refused, and the old password still works', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const { email } = getSaved(agent.user.id);

  const response = await changePassword(agent, {
    current_password: 'not-the-password',
    new_password: 'a-brand-new-password',
    new_password_again: 'a-brand-new-password',
  });

  // 400 is the HTTP status code for "Bad Request"
  assert.strictEqual(response.status, 400);
  assert.match(response.text, /Your current password is incorrect\./);
  assert.ok(await canLogIn(email, TEST_PASSWORD), 'the old password still logs in');
});

test('a new password that is too short or too long is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const { email } = getSaved(agent.user.id);

  const tooShort = await changePassword(agent, {
    current_password: TEST_PASSWORD,
    new_password: 'short',
    new_password_again: 'short',
  });
  const tooLong = await changePassword(agent, {
    current_password: TEST_PASSWORD,
    new_password: 'p'.repeat(73),
    new_password_again: 'p'.repeat(73),
  });

  assert.strictEqual(tooShort.status, 400);
  assert.match(tooShort.text, /Your new password must be at least 8 characters\./);
  assert.strictEqual(tooLong.status, 400);
  assert.match(tooLong.text, /Your new password must be 72 characters or fewer\./);
  assert.ok(await canLogIn(email, TEST_PASSWORD), 'the old password still logs in');
});

test('two new passwords that differ are refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const { email } = getSaved(agent.user.id);

  const response = await changePassword(agent, {
    current_password: TEST_PASSWORD,
    new_password: 'a-brand-new-password',
    new_password_again: 'a-brand-new-pasword',
  });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /The two new passwords do not match\./);
  assert.ok(await canLogIn(email, TEST_PASSWORD), 'the old password still logs in');
});

test('a refused password form never puts any password back into the page', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await changePassword(agent, {
    current_password: 'secret-current-typed',
    new_password: 'secret-new-typed-1',
    new_password_again: 'secret-new-typed-2',
  });

  assert.strictEqual(response.status, 400);
  assert.doesNotMatch(response.text, /secret-current-typed|secret-new-typed/);
});

test('a logged-out visitor cannot change a password', async () => {
  const response = await request(app).post('/account/password').type('form').send({
    current_password: TEST_PASSWORD,
    new_password: 'a-brand-new-password',
    new_password_again: 'a-brand-new-password',
  });

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});
