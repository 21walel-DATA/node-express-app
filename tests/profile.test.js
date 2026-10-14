// tests/profile.test.js
// Tests for feature 02, Profiles (specs/02-profiles.md).
// This first group covers the profile page, /profile/:id.
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

// ---------------------------------------------------------
// TEST DATA
// ---------------------------------------------------------

// Two categories, each with one skill, and one interest.
// INSERT OR IGNORE skips any row that is already there.
db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run('Business');
db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run('Tech');
db.prepare(
  'INSERT OR IGNORE INTO skills (name, category_id) VALUES (?, (SELECT id FROM categories WHERE name = ?))'
).run('Sales', 'Business');
db.prepare(
  'INSERT OR IGNORE INTO skills (name, category_id) VALUES (?, (SELECT id FROM categories WHERE name = ?))'
).run('JavaScript', 'Tech');
db.prepare('INSERT OR IGNORE INTO interests (name) VALUES (?)').run('Fintech');

// Gives a user a full profile: a bio, a business idea and one tick in
// every list. Sales is a skill they have; JavaScript is one they want.
function fillProfile(userId) {
  db.prepare('UPDATE users SET bio = ?, business_idea = ? WHERE id = ?').run(
    'I love selling things.',
    'An app for local markets.',
    userId
  );

  // The ? placeholders keep the values separate from the SQL
  db.prepare(
    `INSERT INTO user_looking_for (user_id, option_id)
     VALUES (?, (SELECT id FROM looking_for_options WHERE code = 'cofounder'))`
  ).run(userId);
  db.prepare(
    `INSERT INTO user_skills (user_id, skill_id, kind)
     VALUES (?, (SELECT id FROM skills WHERE name = 'Sales'), 'has')`
  ).run(userId);
  db.prepare(
    `INSERT INTO user_skills (user_id, skill_id, kind)
     VALUES (?, (SELECT id FROM skills WHERE name = 'JavaScript'), 'wants')`
  ).run(userId);
  db.prepare(
    `INSERT INTO user_interests (user_id, interest_id)
     VALUES (?, (SELECT id FROM interests WHERE name = 'Fintech'))`
  ).run(userId);
}

// ---------------------------------------------------------
// PROFILE PAGE: /profile/:id
// ---------------------------------------------------------

// 1. NORMAL CASE: the page shows the person's details and all their ticks
test('a profile page shows the name, course, initials, text and ticks', async () => {
  const agent = await loginAs(app);
  const ada = createUser({ name: 'Ada Lane', setupComplete: true });
  fillProfile(ada.id);

  const response = await agent.get(`/profile/${ada.id}`);

  // 200 is the HTTP status code for "OK"
  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Ada Lane<\/h1>/);
  // createUser puts people on the first course
  assert.match(response.text, /Software development/);
  // The coloured circle holds the initials
  assert.match(response.text, /class="initials"[^>]*>AL</);
  assert.match(response.text, /I love selling things\./);
  assert.match(response.text, /An app for local markets\./);
  assert.match(response.text, /Co-founder \/ business partner/);
  assert.match(response.text, /Fintech/);
  // [\s\S]* means "any text, across lines". This checks the ORDER:
  // Sales sits under its category in the "has" list, and JavaScript sits
  // under its category in the "looking for" list.
  assert.match(
    response.text,
    /Has these skills[\s\S]*Business[\s\S]*Sales[\s\S]*Looking for these skills[\s\S]*Tech[\s\S]*JavaScript/
  );
});

// 2. NORMAL CASE: a one-word name gives one initial
test('a one-word name shows one initial', async () => {
  const agent = await loginAs(app);
  const cher = createUser({ name: 'Cher', setupComplete: true });

  const response = await agent.get(`/profile/${cher.id}`);

  assert.match(response.text, /class="initials"[^>]*>C</);
});

// 3. NORMAL CASE: your own page has the "Edit my profile" link
test('your own profile page shows "Edit my profile"', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get(`/profile/${agent.user.id}`);

  assert.match(response.text, /<a href="\/profile\/edit">Edit my profile<\/a>/);
});

// 4. NORMAL CASE: you can see your own profile before setup is finished
test('you can see your own unfinished profile', async () => {
  // loginAs makes a user whose setup is NOT finished, unless told otherwise
  const agent = await loginAs(app, { name: 'Nina New' });

  const response = await agent.get(`/profile/${agent.user.id}`);

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Nina New<\/h1>/);
});

// 5. DENIED ACCESS: someone else's page has no edit link
test('someone else\'s profile page does not show "Edit my profile"', async () => {
  const agent = await loginAs(app);
  const other = createUser({ setupComplete: true });

  const response = await agent.get(`/profile/${other.id}`);

  // Check the page loaded, so the test is not passing by accident
  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /Edit my profile/);
});

// 6. SECURITY: the email address is never shown
test('a profile page does not show the email address', async () => {
  const agent = await loginAs(app);
  const eve = createUser({ name: 'Eve Private', setupComplete: true });

  const response = await agent.get(`/profile/${eve.id}`);

  assert.match(response.text, /Eve Private/);
  assert.doesNotMatch(response.text, new RegExp(eve.email));
});

// 7. SECURITY: text a user typed is shown as plain text, never run as code.
// If a bio could hold a working <script> tag, one user could run their
// own code in other people's browsers.
test('a bio containing HTML is shown as plain text', async () => {
  const agent = await loginAs(app);
  const sneaky = createUser({ setupComplete: true });
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run('<script>alert(1)</script>', sneaky.id);

  const response = await agent.get(`/profile/${sneaky.id}`);

  assert.doesNotMatch(response.text, /<script>alert\(1\)<\/script>/);
  // EJS turns < into &lt; so the browser shows it instead of running it
  assert.match(response.text, /&lt;script&gt;/);
});

// 8. DENIED ACCESS: a logged-out visitor is sent to the login page
test('a logged-out visitor cannot see a profile page', async () => {
  const someone = createUser({ setupComplete: true });

  const response = await request(app).get(`/profile/${someone.id}`);

  // 302 is the HTTP status code for "go to this other address instead"
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// 9. NO RESULTS: a number that belongs to nobody
test('a profile number that does not exist shows "Profile not found"', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/profile/999999');

  // 404 is the HTTP status code for "Not Found"
  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
});

// 10. NO RESULTS: an address that is not a number at all
test('a profile address that is not a number shows "Profile not found"', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/profile/abc');

  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
});

// 11. NO RESULTS: someone else's profile that is not finished yet
test('someone else\'s unfinished profile shows "Profile not found"', async () => {
  const agent = await loginAs(app);
  const unfinished = createUser({ name: 'Una Finished' });

  const response = await agent.get(`/profile/${unfinished.id}`);

  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
  // Nothing about the person leaks out
  assert.doesNotMatch(response.text, /Una Finished/);
});

// ---------------------------------------------------------
// PROFILE FORM: /profile/edit (showing it; saving comes in step 3)
// ---------------------------------------------------------

// Looks up a skill's or an interest's id by its name, so the tests can
// use readable names like 'Sales' instead of id numbers
function skillId(name) {
  return db.prepare('SELECT id FROM skills WHERE name = ?').get(name).id;
}
function interestId(name) {
  return db.prepare('SELECT id FROM interests WHERE name = ?').get(name).id;
}

// 12. NORMAL CASE: the form shows every list, with skills grouped by category
test('the profile form shows all the lists and both text boxes', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/profile/edit');

  assert.strictEqual(response.status, 200);
  // The form sends its answers back to the same address
  assert.match(response.text, /<form method="post" action="\/profile\/edit"/);
  // All five "looking for" options, which schema.sql always adds
  for (const label of [
    'Co-founder / business partner',
    'Project collaborator',
    'Find a mentor',
    'Be a mentor',
    'Meet people socially',
  ]) {
    assert.match(response.text, new RegExp(label));
  }
  // Both skill lists, each grouped under the category headings, in order
  assert.match(
    response.text,
    /Skills I have[\s\S]*Business[\s\S]*Sales[\s\S]*Tech[\s\S]*JavaScript[\s\S]*Skills I am looking for[\s\S]*Business[\s\S]*Sales[\s\S]*Tech[\s\S]*JavaScript/
  );
  assert.match(response.text, /Interests[\s\S]*Fintech/);
  // The two optional text boxes, each limited to 500 characters
  assert.match(response.text, /<textarea id="bio" name="bio" maxlength="500"/);
  assert.match(response.text, /<textarea id="business_idea" name="business_idea" maxlength="500"/);
});

// 13. NORMAL CASE: a new user is setting up, so the heading says so
test('a new user sees "Set up your profile"', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/profile/edit');

  assert.match(response.text, /<h1>Set up your profile<\/h1>/);
});

// 14. NORMAL CASE: a user who has finished setup is editing
test('a user who finished setup sees "Edit my profile"', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/profile/edit');

  assert.match(response.text, /<h1>Edit my profile<\/h1>/);
});

// 15. NORMAL CASE: what the user saved before is already ticked and filled in
test('the form shows the user\'s saved ticks and text', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  // Sales (has), JavaScript (wants), Fintech, Co-founder, and both texts
  fillProfile(agent.user.id);

  const response = await agent.get('/profile/edit');
  const sales = skillId('Sales');
  const javascript = skillId('JavaScript');

  // [^>]* means "anything up to the end of this tag", so these check that
  // the word "checked" is inside that one checkbox's tag
  assert.match(response.text, new RegExp(`id="has-${sales}"[^>]*checked`));
  assert.match(response.text, new RegExp(`id="wants-${javascript}"[^>]*checked`));
  assert.match(response.text, new RegExp(`id="interest-${interestId('Fintech')}"[^>]*checked`));
  // Only what was saved is ticked
  assert.doesNotMatch(response.text, new RegExp(`id="has-${javascript}"[^>]*checked`));
  assert.doesNotMatch(response.text, new RegExp(`id="wants-${sales}"[^>]*checked`));
  // The saved text is inside the text boxes
  assert.match(response.text, /<textarea id="bio"[^>]*>I love selling things\.<\/textarea>/);
  assert.match(response.text, /<textarea id="business_idea"[^>]*>An app for local markets\.<\/textarea>/);
});

// 16. NORMAL CASE (PRD section 7): every tick box has its own label
test('every tick box on the form has a label', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/profile/edit');

  // Collect the id of every checkbox on the page.
  // matchAll finds every match; m[1] is the part inside the brackets.
  const ids = [...response.text.matchAll(/type="checkbox" id="([^"]+)"/g)].map((m) => m[1]);

  // 5 "looking for" + 2 skills twice + 1 interest = at least 10 tick boxes
  assert.ok(ids.length >= 10, `expected at least 10 tick boxes, found ${ids.length}`);
  for (const id of ids) {
    assert.match(response.text, new RegExp(`<label for="${id}">`));
  }
});

// 17. DENIED ACCESS: the form only ever shows your OWN answers
test('the form never shows another user\'s answers', async () => {
  // Someone else fills in a profile...
  const other = createUser({ setupComplete: true });
  fillProfile(other.id);
  // ...and a different, new user opens the form
  const agent = await loginAs(app);

  const response = await agent.get('/profile/edit');

  // Check the form loaded, so the test is not passing by accident
  assert.match(response.text, /<h1>Set up your profile<\/h1>/);
  assert.doesNotMatch(response.text, /checked/);
  assert.doesNotMatch(response.text, /I love selling things/);
});

// 18. DENIED ACCESS: a logged-out visitor is sent to the login page
test('a logged-out visitor cannot see the profile form', async () => {
  const response = await request(app).get('/profile/edit');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});
