// tests/loginHelper.js
// Gives a test a pretend user who is already logged in.
//
// How to use it in a test file:
//   const app = require('./helpers');
//   const { loginAs } = require('./loginHelper');
//
//   test('a logged-in user can see their profile', async () => {
//     const agent = await loginAs(app);
//     const response = await agent.get('/profile');
//     ...
//   });
//
// "agent" works like request(app), with one difference: it keeps cookies
// between requests, the way a browser does. That is what keeps it logged in.
// agent.user is the pretend user's row from the database (id, name, ...).
//
// Options, all optional:
//   await loginAs(app, { name: 'Ada', setupComplete: true, isAdmin: true });

const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../db');

// Every pretend user has this password
const TEST_PASSWORD = 'test-password';

// Hash the password once and reuse it. 4 rounds is the fastest setting
// bcrypt allows: fine for tests, far too weak for real accounts.
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

// Counts the users made so far, so each one gets a different email
let userCount = 0;

// Creates a user straight in the database (skipping the registration form)
// and returns their row.
function createUser(options = {}) {
  userCount += 1;

  // Use the first course unless the test asks for a particular one
  const firstCourse = db.prepare('SELECT id FROM courses ORDER BY id LIMIT 1').get();

  const result = db
    .prepare(
      `INSERT INTO users
         (name, email, password_hash, course_id, is_admin, setup_complete,
          privacy_agreed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      options.name || `Test User ${userCount}`,
      options.email || `test-user-${userCount}@example.com`,
      TEST_PASSWORD_HASH,
      options.courseId || firstCourse.id,
      // The database stores yes/no as 1/0
      options.isAdmin ? 1 : 0,
      options.setupComplete ? 1 : 0,
      new Date().toISOString()
    );

  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
}

// Creates a user, logs them in through the real /login route, and returns
// an agent that stays logged in.
async function loginAs(app, options = {}) {
  const user = createUser(options);

  // request.agent(app) is a pretend browser that remembers cookies
  const agent = request.agent(app);

  const response = await agent
    .post('/login')
    .type('form')
    .send({ email: user.email, password: TEST_PASSWORD });

  // Stop with a clear message if the login itself is broken, so the
  // failure is not mistaken for a problem in the test that called us
  if (response.status !== 302) {
    throw new Error(`loginAs could not log in (status ${response.status})`);
  }

  // Attach the user's row so tests can read agent.user.id and so on
  agent.user = user;
  return agent;
}

module.exports = { loginAs, createUser, TEST_PASSWORD };
