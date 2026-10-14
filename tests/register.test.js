// tests/register.test.js
// Tests for the registration routes in routes/auth.js.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const bcrypt = require('bcryptjs');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');

// The id of a real course, for the form's course field
const courseId = db.prepare('SELECT id FROM courses LIMIT 1').get().id;

// A correctly filled-in form. Each test copies it and changes one thing:
//   { ...validForm, email: 'other@example.com' }
// means "everything in validForm, but with this email instead".
const validForm = {
  name: 'Sam Taylor',
  email: 'sam@example.com',
  password: 'correct-horse',
  course_id: courseId,
  privacy: 'yes',
};

// Sends the registration form the way a browser does.
// .type('form') encodes the fields like an HTML form.
function register(form) {
  return request(app).post('/register').type('form').send(form);
}

// Finds a user row by email, or undefined when there is none
function findUser(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

// ---------------------------------------------------------
// REGISTRATION
// ---------------------------------------------------------

// 1. NORMAL CASE: the form is shown, with the courses from the database
test('GET /register shows the form with the courses', async () => {
  const response = await request(app).get('/register');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Create an account<\/h1>/);
  assert.match(response.text, /Software development/);
  assert.match(response.text, /Business development/);
});

// 2. NORMAL CASE: a correct form creates the account and logs the user in
test('a valid registration creates the user and logs them in', async () => {
  const response = await register(validForm);

  // 302 is the HTTP status code for a redirect: "go to this other page"
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/');
  // A session cookie was sent, which is what keeps the user logged in
  assert.ok(response.headers['set-cookie']);

  const user = findUser('sam@example.com');
  assert.strictEqual(user.name, 'Sam Taylor');
  assert.strictEqual(user.course_id, courseId);
  // The date they agreed to the privacy notice was saved
  assert.ok(user.privacy_agreed_at);
  // A new account is never an admin and has not finished setup
  assert.strictEqual(user.is_admin, 0);
  assert.strictEqual(user.setup_complete, 0);
});

// 3. NORMAL CASE: the password in the database is not readable
test('the password is stored hashed, not as plain text', async () => {
  await register({ ...validForm, email: 'hash@example.com' });

  const user = findUser('hash@example.com');
  // The stored value is not the password itself...
  assert.notStrictEqual(user.password_hash, 'correct-horse');
  // ...but bcrypt can confirm that the password matches it
  assert.strictEqual(bcrypt.compareSync('correct-horse', user.password_hash), true);
});

// 4. BAD INPUT: registering without agreeing to the privacy notice is refused
test('registering without the privacy tick is refused', async () => {
  // Leave the privacy field out, which is what an unticked checkbox does
  const form = { ...validForm, email: 'noprivacy@example.com' };
  delete form.privacy;

  const response = await register(form);

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /You must agree to the privacy notice/);
  // No account was created
  assert.strictEqual(findUser('noprivacy@example.com'), undefined);
});

// 5. BAD INPUT: an email that is already in use is refused, in any letter case
test('registering with an email already in use is refused', async () => {
  await register({ ...validForm, email: 'taken@example.com' });

  const response = await register({ ...validForm, email: 'TAKEN@example.com' });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /already exists/);
});

// 6. BAD INPUT: a password that is too short is refused
test('registering with a short password is refused', async () => {
  const response = await register({
    ...validForm,
    email: 'short@example.com',
    password: 'abc',
  });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /at least 8 characters/);
  assert.strictEqual(findUser('short@example.com'), undefined);
});

// 7. BAD INPUT: a course that does not exist is refused
test('registering with a course that does not exist is refused', async () => {
  const response = await register({
    ...validForm,
    email: 'nocourse@example.com',
    course_id: 9999,
  });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /Choose your course/);
  assert.strictEqual(findUser('nocourse@example.com'), undefined);
});

// 8. BAD INPUT: after a mistake, the form keeps what was typed (not the password)
test('a refused form is shown again with the typed values', async () => {
  const response = await register({
    ...validForm,
    email: 'refill@example.com',
    password: 'abc',
  });

  assert.match(response.text, /value="Sam Taylor"/);
  assert.match(response.text, /value="refill@example.com"/);
  // The password must never be sent back to the page
  assert.doesNotMatch(response.text, /value="abc"/);
});
