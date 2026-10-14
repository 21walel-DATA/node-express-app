// tests/home.test.js
// Tests for the home page (the dashboard) in routes/home.js, and for the
// links in the shared header.
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

// A skill for the dashboard tests to tick.
// INSERT OR IGNORE skips it if it is already there.
db.prepare('INSERT OR IGNORE INTO skills (name) VALUES (?)').run('Sales');
const salesId = db.prepare('SELECT id FROM skills WHERE name = ?').get('Sales').id;

// Ticks the Sales skill for a user, as 'has' or 'wants'
function tickSales(userId, kind) {
  db.prepare('INSERT INTO user_skills (user_id, skill_id, kind) VALUES (?, ?, ?)').run(userId, salesId, kind);
}

// ---------------------------------------------------------
// HOME PAGE
// ---------------------------------------------------------

// 1. NORMAL CASE: a logged-in user gets the dashboard as HTML
test('GET / shows the dashboard to a logged-in user', async () => {
  const agent = await loginAs(app, { name: 'Sam Taylor', setupComplete: true });

  // Ask the app for the home page and wait for the answer
  const response = await agent.get('/');

  // 200 is the HTTP status code for "OK"
  assert.strictEqual(response.status, 200);
  // The answer should be a web page, not JSON
  assert.match(response.headers['content-type'], /html/);
  // response.text is the HTML. Check the heading and the stylesheet link.
  assert.match(response.text, /<h1>Your matches<\/h1>/);
  assert.match(response.text, /href="\/style.css"/);
  // The page greets the logged-in user by name
  assert.match(response.text, /Welcome, Sam Taylor/);
});

// 2. NORMAL CASE: the shared stylesheet is served from public/, even to a
// logged-out visitor (the login page needs it too)
test('GET /style.css returns the stylesheet', async () => {
  const response = await request(app).get('/style.css');

  assert.strictEqual(response.status, 200);
  assert.match(response.headers['content-type'], /css/);
});

// 3. DENIED ACCESS: the old open practice routes must stay removed
test('GET /api/users is not available', async () => {
  // Logged in, so the answer comes from the routes and not the login check
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/api/users');

  // 404 is the HTTP status code for "Not Found"
  assert.strictEqual(response.status, 404);
});

// ---------------------------------------------------------
// DASHBOARD MATCHES
// (The scoring itself is tested in matching.test.js. These tests check
// that the page shows what findMatches() returns.)
// ---------------------------------------------------------

// 4. NORMAL CASE: a match is shown with its reason and a link to the profile
test('the dashboard shows a match with its reason and profile link', async () => {
  const agent = await loginAs(app, { name: 'Wanda Wants', setupComplete: true });
  tickSales(agent.user.id, 'wants');

  const seller = createUser({ name: 'Sid Seller', setupComplete: true });
  tickSales(seller.id, 'has');

  const response = await agent.get('/');

  assert.match(response.text, /Sid Seller/);
  assert.match(response.text, /Has a skill you are looking for: Sales/);
  assert.match(response.text, /3 points/);
  assert.match(response.text, new RegExp(`href="/profile/${seller.id}"`));
});

// 5. SECURITY: a match's email address is never shown on the dashboard
test('the dashboard does not show email addresses', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  tickSales(agent.user.id, 'wants');

  const seller = createUser({ name: 'Eve Private', setupComplete: true });
  tickSales(seller.id, 'has');

  const response = await agent.get('/');

  // Check the match is there, so the test is not passing by accident
  assert.match(response.text, /Eve Private/);
  assert.doesNotMatch(response.text, new RegExp(seller.email));
});

// 6. EDGE CASE (roadmap finish line): nobody qualifies, so say so
test('a user with no matches sees "No matches yet"', async () => {
  // A brand new user has ticked nothing, so nobody can score with them
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/');

  assert.match(response.text, /No matches yet/);
  assert.doesNotMatch(response.text, /class="match-card"/);
});

// 7. DENIED ACCESS: a logged-out visitor is sent to the login page
test('a logged-out visitor cannot see the dashboard', async () => {
  const response = await request(app).get('/');

  // 302 is the HTTP status code for "go to this other address instead"
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// ---------------------------------------------------------
// HEADER LINKS
// ---------------------------------------------------------

// 8. NORMAL CASE: a logged-in user sees "My profile", linking to their own page
test('the header shows a "My profile" link to a logged-in user', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/');

  assert.match(response.text, new RegExp(`<a href="/profile/${agent.user.id}">My profile</a>`));
});

// 9. EDGE CASE: a logged-out visitor does not see "My profile"
test('the header does not show "My profile" to a logged-out visitor', async () => {
  // The login page is public, so a logged-out visitor can open it
  const response = await request(app).get('/login');

  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /My profile/);
});
