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
  const agent = await loginAs(app, { setupComplete: true });
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
  const agent = await loginAs(app, { setupComplete: true });
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

// 4. DENIED ACCESS: before setup is finished, even your own profile page
// sends you to the form (the setup gate, Koulla's decision 2a)
test('a new user who opens their own profile is sent to the form', async () => {
  // loginAs makes a user whose setup is NOT finished, unless told otherwise
  const agent = await loginAs(app);

  const response = await agent.get(`/profile/${agent.user.id}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/profile/edit');
});

// 5. DENIED ACCESS: someone else's page has no edit link
test('someone else\'s profile page does not show "Edit my profile"', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });

  const response = await agent.get(`/profile/${other.id}`);

  // Check the page loaded, so the test is not passing by accident
  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /Edit my profile/);
});

// 6. SECURITY: the email address is never shown
test('a profile page does not show the email address', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const eve = createUser({ name: 'Eve Private', setupComplete: true });

  const response = await agent.get(`/profile/${eve.id}`);

  assert.match(response.text, /Eve Private/);
  assert.doesNotMatch(response.text, new RegExp(eve.email));
});

// 7. SECURITY: text a user typed is shown as plain text, never run as code.
// If a bio could hold a working <script> tag, one user could run their
// own code in other people's browsers.
test('a bio containing HTML is shown as plain text', async () => {
  const agent = await loginAs(app, { setupComplete: true });
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
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/profile/999999');

  // 404 is the HTTP status code for "Not Found"
  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
});

// 10. NO RESULTS: an address that is not a number at all
test('a profile address that is not a number shows "Profile not found"', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/profile/abc');

  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
});

// 11. NO RESULTS: someone else's profile that is not finished yet
test('someone else\'s unfinished profile shows "Profile not found"', async () => {
  const agent = await loginAs(app, { setupComplete: true });
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

// ---------------------------------------------------------
// SAVING THE PROFILE FORM: POST /profile/edit
// ---------------------------------------------------------

// One more interest, so a test can tick two
db.prepare('INSERT OR IGNORE INTO interests (name) VALUES (?)').run('Gaming');

// Looks up a "looking for" option's id by its code, e.g. 'cofounder'
function optionId(code) {
  return db.prepare('SELECT id FROM looking_for_options WHERE code = ?').get(code).id;
}

// A form that passes every rule. A test can change any field, e.g.
// validForm({ bio: 'Hello' }) or validForm({ interests: [] }).
// "...changes" copies the test's changes over the top of the defaults.
function validForm(changes = {}) {
  return {
    looking_for: [optionId('cofounder')],
    skills_has: [skillId('Sales')],
    skills_wants: [skillId('JavaScript')],
    interests: [interestId('Fintech')],
    bio: 'I love selling things.',
    business_idea: 'An app for local markets.',
    ...changes,
  };
}

// Sends a form the way a real browser does: a list becomes the same name
// repeated, e.g. looking_for=1&looking_for=4. An empty list sends nothing,
// just like a group of tick boxes with none ticked.
function postForm(agent, fields) {
  // URLSearchParams builds the "name=value&name=value" text a form sends
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        body.append(name, item);
      }
    } else {
      body.append(name, value);
    }
  }
  return agent.post('/profile/edit').type('form').send(body.toString());
}

// Reads one list of id numbers from the database, sorted smallest first,
// so tests can compare lists easily
function idList(sql, userId) {
  return db
    .prepare(sql)
    .all(userId)
    .map((row) => row.id)
    .sort((a, b) => a - b);
}

// Reads back everything saved for a user, so tests can check the database
function savedProfile(userId) {
  const user = db
    .prepare('SELECT bio, business_idea, setup_complete FROM users WHERE id = ?')
    .get(userId);

  return {
    bio: user.bio,
    businessIdea: user.business_idea,
    setupComplete: user.setup_complete,
    lookingFor: idList('SELECT option_id AS id FROM user_looking_for WHERE user_id = ?', userId),
    skillsHas: idList("SELECT skill_id AS id FROM user_skills WHERE user_id = ? AND kind = 'has'", userId),
    skillsWants: idList("SELECT skill_id AS id FROM user_skills WHERE user_id = ? AND kind = 'wants'", userId),
    interests: idList('SELECT interest_id AS id FROM user_interests WHERE user_id = ?', userId),
  };
}

// 19. NORMAL CASE: a valid form is saved and the user goes to the home page
test('a valid form saves the profile, finishes setup and goes to /', async () => {
  const agent = await loginAs(app);

  const response = await postForm(agent, validForm());

  // 302 is the HTTP status code for "go to this other address instead"
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/');
  assert.deepStrictEqual(savedProfile(agent.user.id), {
    bio: 'I love selling things.',
    businessIdea: 'An app for local markets.',
    setupComplete: 1,
    lookingFor: [optionId('cofounder')],
    skillsHas: [skillId('Sales')],
    skillsWants: [skillId('JavaScript')],
    interests: [interestId('Fintech')],
  });
});

// 20. NORMAL CASE: several ticks in one list are all saved
// (the browser sends them as a list)
test('two or more ticks in a list are all saved', async () => {
  const agent = await loginAs(app);
  const twoOptions = [optionId('cofounder'), optionId('social')].sort((a, b) => a - b);

  await postForm(
    agent,
    validForm({ looking_for: twoOptions, interests: [interestId('Fintech'), interestId('Gaming')] })
  );

  const saved = savedProfile(agent.user.id);
  assert.deepStrictEqual(saved.lookingFor, twoOptions);
  assert.strictEqual(saved.interests.length, 2);
});

// 21. NORMAL CASE: a single tick is saved (the browser sends it as plain
// text, not as a list)
test('a single tick in a list is saved', async () => {
  const agent = await loginAs(app);

  await postForm(agent, validForm({ interests: String(interestId('Gaming')) }));

  assert.deepStrictEqual(savedProfile(agent.user.id).interests, [interestId('Gaming')]);
});

// 22. NORMAL CASE: saving again replaces the old answers
test('saving again replaces the old ticks and text', async () => {
  const agent = await loginAs(app);
  await postForm(agent, validForm({ interests: [interestId('Fintech'), interestId('Gaming')] }));

  // Untick Fintech, empty the bio, and type only spaces in the business idea
  await postForm(agent, validForm({ interests: [interestId('Gaming')], bio: '', business_idea: '   ' }));

  const saved = savedProfile(agent.user.id);
  assert.deepStrictEqual(saved.interests, [interestId('Gaming')]);
  // Empty, or only spaces, is saved as "nothing" (null)
  assert.strictEqual(saved.bio, null);
  assert.strictEqual(saved.businessIdea, null);
});

// 23. NORMAL CASE: exactly 500 characters is allowed, even with a new line
test('a bio and business idea of exactly 500 characters are saved', async () => {
  const agent = await loginAs(app);
  // A browser sends a new line as two characters (\r\n) but counts it as
  // one. 498 letters + one new line + 1 letter = 500, as the browser counts.
  const withNewLine = 'a'.repeat(498) + '\r\n' + 'b';

  const response = await postForm(agent, validForm({ bio: 'a'.repeat(500), business_idea: withNewLine }));

  assert.strictEqual(response.status, 302);
  assert.strictEqual(savedProfile(agent.user.id).bio.length, 500);
});

// 24. BAD INPUT: each list left empty is refused with its own message.
// The same test runs four times, once for each list.
const emptyListCases = [
  { field: 'looking_for', message: 'Tick at least one thing you are looking for.' },
  { field: 'skills_has', message: 'Tick at least one skill you have.' },
  { field: 'skills_wants', message: 'Tick at least one skill you are looking for.' },
  { field: 'interests', message: 'Tick at least one interest.' },
];
for (const { field, message } of emptyListCases) {
  test(`an empty ${field} list is refused, nothing is saved, and the form is refilled`, async () => {
    const agent = await loginAs(app);

    // [field] means "the field whose name is in this variable"
    const response = await postForm(agent, validForm({ [field]: [] }));

    // 400 is the HTTP status code for "Bad Request"
    assert.strictEqual(response.status, 400);
    assert.match(response.text, new RegExp(message));

    // Nothing was saved: no ticks, no bio, and setup is not finished
    const saved = savedProfile(agent.user.id);
    assert.strictEqual(saved.setupComplete, 0);
    assert.deepStrictEqual(saved.lookingFor, []);
    assert.strictEqual(saved.bio, null);

    // The other answers are still filled in on the form. Fintech was sent
    // every time except when the interests list is the empty one.
    if (field !== 'interests') {
      assert.match(response.text, new RegExp(`id="interest-${interestId('Fintech')}"[^>]*checked`));
    }
    assert.match(response.text, /<textarea id="bio"[^>]*>I love selling things\.<\/textarea>/);
  });
}

// 25. BAD INPUT: 501 characters is one too many
test('a bio or business idea of 501 characters is refused', async () => {
  const agent = await loginAs(app);

  const response = await postForm(agent, validForm({ bio: 'a'.repeat(501), business_idea: 'b'.repeat(501) }));

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /Your bio must be 500 characters or fewer\./);
  assert.match(response.text, /Your business idea must be 500 characters or fewer\./);
  assert.strictEqual(savedProfile(agent.user.id).setupComplete, 0);
});

// 26. BAD INPUT: a tick that is not on the lists (someone changed what
// their browser sends). The same test runs for a missing number and for
// something that is not a number at all.
for (const badValue of ['999999', 'abc']) {
  test(`a tick of "${badValue}" that is not on the lists is refused`, async () => {
    const agent = await loginAs(app);

    const response = await postForm(agent, validForm({ skills_has: [skillId('Sales'), badValue] }));

    assert.strictEqual(response.status, 400);
    assert.match(response.text, /One of the ticks is not on the lists\. Please try again\./);
    assert.deepStrictEqual(savedProfile(agent.user.id).skillsHas, []);
  });
}

// 27. DENIED ACCESS: the form only ever changes the logged-in user
test('sending another user\'s number with the form changes only your own profile', async () => {
  const other = createUser({ setupComplete: true });
  fillProfile(other.id);
  const before = savedProfile(other.id);
  const agent = await loginAs(app);

  // Try to sneak the other person's id in, under a few likely names
  await postForm(agent, validForm({ id: other.id, user_id: other.id, bio: 'Hacked!' }));

  // The other person is untouched; only the sender's own profile changed
  assert.deepStrictEqual(savedProfile(other.id), before);
  assert.strictEqual(savedProfile(agent.user.id).bio, 'Hacked!');
});

// 28. DENIED ACCESS: a logged-out visitor cannot save a profile
test('a logged-out visitor cannot save a profile', async () => {
  const response = await postForm(request(app), validForm());

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// ---------------------------------------------------------
// THE SETUP GATE (middleware/setup.js)
// A logged-in user who has not finished setup is sent to the form.
// ---------------------------------------------------------

// 29. NORMAL CASE: a finished user walks straight through the gate
test('a user who finished setup can open the dashboard', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /<h1>Your matches<\/h1>/);
});

// 30. NORMAL CASE: the whole journey, from new user to dashboard
test('a new user who saves the form can then open the dashboard', async () => {
  const agent = await loginAs(app);

  // Before saving: sent to the form
  const before = await agent.get('/');
  assert.strictEqual(before.headers.location, '/profile/edit');

  // Save a valid form...
  await postForm(agent, validForm());

  // ...and now the dashboard opens
  const after = await agent.get('/');
  assert.strictEqual(after.status, 200);
  assert.match(after.text, /<h1>Your matches<\/h1>/);
});

// 31. DENIED ACCESS: a new user is sent from the dashboard to the form
test('a new user who opens the dashboard is sent to the form', async () => {
  const agent = await loginAs(app);

  const response = await agent.get('/');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/profile/edit');
});

// 32. DENIED ACCESS: a new user is sent from someone's profile to the form
test('a new user who opens someone else\'s profile is sent to the form', async () => {
  const other = createUser({ setupComplete: true });
  const agent = await loginAs(app);

  const response = await agent.get(`/profile/${other.id}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/profile/edit');
});

// 33. NORMAL CASE: the gate never blocks the form itself, or a refused form
test('a new user can open the form, and a refused form shows its messages', async () => {
  const agent = await loginAs(app);

  const form = await agent.get('/profile/edit');
  assert.strictEqual(form.status, 200);

  const refused = await postForm(agent, validForm({ interests: [] }));
  assert.strictEqual(refused.status, 400);
  assert.match(refused.text, /Tick at least one interest\./);
});

// 34. NORMAL CASE (spec row): the gate lets the privacy notice, the
// stylesheet and logging out through
test('a new user can still open the privacy notice and the stylesheet, and log out', async () => {
  const agent = await loginAs(app);

  const privacy = await agent.get('/privacy');
  assert.strictEqual(privacy.status, 200);

  const stylesheet = await agent.get('/style.css');
  assert.strictEqual(stylesheet.status, 200);

  const logout = await agent.post('/logout');
  assert.strictEqual(logout.status, 302);
  // Logging out goes to the login page, not to the form
  assert.strictEqual(logout.headers.location, '/login');
});

// 35. DENIED ACCESS: a logged-out visitor goes to log in, not to the form
test('a logged-out visitor is sent to the login page, not the form', async () => {
  const response = await request(app).get('/');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});
