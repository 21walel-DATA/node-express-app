// tests/admin-lists.test.js
// Tests for the admin list pages in routes/admin.js (courses, categories,
// skills and interests).
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');
// loginAs gives us a pretend user who is already logged in.
// createUser adds a user without logging them in.
const { loginAs, createUser } = require('./loginHelper');

// Finds a row in a list by name, or undefined when there is none
function findRow(table, name) {
  // The table names below are typed by us in the tests, never by a user
  return db.prepare(`SELECT id, name FROM ${table} WHERE name = ?`).get(name);
}

// Adds an entry straight into the database and returns its id
function addRow(table, name) {
  return db.prepare(`INSERT INTO ${table} (name) VALUES (?)`).run(name).lastInsertRowid;
}

// Sends the add form the way a browser does
function addEntry(agent, path, name) {
  return agent.post(`/admin/${path}`).type('form').send({ name });
}

// ---------------------------------------------------------
// SHOWING THE LISTS
// ---------------------------------------------------------

// 1. NORMAL CASE: the admin home links to all four list pages
test('the admin home page links to every list', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  const response = await admin.get('/admin');

  for (const path of ['courses', 'categories', 'skills', 'interests']) {
    assert.match(response.text, new RegExp(`href="/admin/${path}"`), `missing link: ${path}`);
  }
});

// 2. NORMAL CASE: the courses page lists the courses in the database
test('the courses page lists the existing courses', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  const response = await admin.get('/admin/courses');

  assert.strictEqual(response.status, 200);
  // schema.sql adds these two courses when the database is new
  assert.match(response.text, /Software development/);
  assert.match(response.text, /Business development/);
});

// ---------------------------------------------------------
// ADDING
// ---------------------------------------------------------

// 3. NORMAL CASE (finish line): a course added by an admin appears on the
// registration form
test('a course added by an admin appears on the registration form', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  const response = await addEntry(admin, 'courses', 'Data analytics');

  // 302: sent back to the list page (Post/Redirect/Get)
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/admin/courses');
  assert.ok(findRow('courses', 'Data analytics'));

  // The registration form is public, so a logged-out visitor can check it
  const form = await request(app).get('/register');
  assert.match(form.text, /Data analytics/);
});

// 4. NORMAL CASE: an interest added by an admin appears on the profile form
test('an interest added by an admin appears on the profile form', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  await addEntry(admin, 'interests', 'Robotics');

  const student = await loginAs(app);
  const form = await student.get('/profile/edit');

  assert.strictEqual(form.status, 200);
  assert.match(form.text, /Robotics/);
});

// 5. INVALID INPUT: an empty name is refused
test('adding an empty name is refused', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  // Only spaces counts as empty, because the name is trimmed
  const response = await addEntry(admin, 'interests', '   ');

  // 400 is the HTTP status code for "Bad Request"
  assert.strictEqual(response.status, 400);
  assert.match(response.text, /Type a name for the new interest/);
});

// 6. INVALID INPUT: a copy is refused, even with different capital letters
test('adding a name that already exists is refused, ignoring case', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  addRow('interests', 'Music');

  const response = await addEntry(admin, 'interests', 'music');

  assert.strictEqual(response.status, 400);
  // EJS writes the " marks as &#34;, its safe way of showing them in HTML
  assert.match(response.text, /&#34;music&#34; is already in the list/);
  // Still only the one row
  assert.strictEqual(findRow('interests', 'music'), undefined);
});

// 7. INVALID INPUT: a name that is too long is refused
test('adding a name over 100 characters is refused', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  const response = await addEntry(admin, 'courses', 'x'.repeat(101));

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /100 characters or fewer/);
});

// ---------------------------------------------------------
// REMOVING
// ---------------------------------------------------------

// 8. NORMAL CASE: removing an interest also removes everyone's tick for it
test('removing an interest also removes the ticks for it', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const interestId = addRow('interests', 'Chess');
  const student = createUser();
  db.prepare('INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)').run(student.id, interestId);

  const response = await admin.post(`/admin/interests/${interestId}/remove`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(findRow('interests', 'Chess'), undefined);
  const ticks = db.prepare('SELECT COUNT(*) AS total FROM user_interests WHERE interest_id = ?').get(interestId);
  assert.strictEqual(ticks.total, 0);
});

// 9. NORMAL CASE: a course nobody is on can be removed
test('a course with no students can be removed', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const courseId = addRow('courses', 'Empty course');

  const response = await admin.post(`/admin/courses/${courseId}/remove`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(findRow('courses', 'Empty course'), undefined);
});

// 10. DENIED ACTION: a course with students on it cannot be removed
test('a course with students on it cannot be removed', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const courseId = addRow('courses', 'Busy course');
  createUser({ courseId });

  const response = await admin.post(`/admin/courses/${courseId}/remove`);

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /This course cannot be removed while students are on it\. Students on it: 1\./);
  assert.ok(findRow('courses', 'Busy course'));
});

// ---------------------------------------------------------
// WHO CAN CHANGE THE LISTS
// ---------------------------------------------------------

// 11. DENIED ACCESS: a student cannot add or remove entries, even by
// sending the form directly
test('a student cannot add or remove entries', async () => {
  const student = await loginAs(app, { setupComplete: true });
  const interestId = addRow('interests', 'Protected');

  const add = await addEntry(student, 'interests', 'Sneaky');
  const remove = await student.post(`/admin/interests/${interestId}/remove`);

  assert.strictEqual(add.status, 403);
  assert.strictEqual(remove.status, 403);
  assert.strictEqual(findRow('interests', 'Sneaky'), undefined);
  assert.ok(findRow('interests', 'Protected'));
});

// ---------------------------------------------------------
// CATEGORIES AND SKILLS
// ---------------------------------------------------------

// Sends the add-a-skill form, with its category dropdown
function addSkill(agent, name, categoryId) {
  return agent.post('/admin/skills').type('form').send({ name, parent_id: categoryId });
}

// 12. NORMAL CASE (finish line): a skill added by an admin appears on the
// profile form under its category
test('a skill added by an admin appears on the profile form under its category', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  await addEntry(admin, 'categories', 'Hardware');
  const category = findRow('categories', 'Hardware');

  const response = await addSkill(admin, 'Soldering', category.id);

  assert.strictEqual(response.status, 302);
  const skill = db.prepare('SELECT category_id FROM skills WHERE name = ?').get('Soldering');
  assert.strictEqual(skill.category_id, category.id);

  // On the form, "Soldering" must come after the "Hardware" heading, with
  // no other category heading in between.
  // ((?!<h3)[\s\S])* means "any characters, as long as no <h3 starts here".
  const student = await loginAs(app);
  const form = await student.get('/profile/edit');
  assert.match(form.text, /Hardware<\/h3>((?!<h3)[\s\S])*Soldering/);
});

// 13. NORMAL CASE: the skills page shows each skill's category
test('the skills page shows each skill with its category', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const categoryId = addRow('categories', 'Kitchen');
  db.prepare('INSERT INTO skills (name, category_id) VALUES (?, ?)').run('Baking', categoryId);

  const response = await admin.get('/admin/skills');

  assert.match(response.text, /Baking\s*<span class="hint">&middot; Kitchen<\/span>/);
});

// 14. INVALID INPUT: a skill must have a real category
test('adding a skill without a real category is refused', async () => {
  const admin = await loginAs(app, { isAdmin: true });

  // No category chosen, then a category id that does not exist
  const none = await addSkill(admin, 'Juggling', '');
  const fake = await addSkill(admin, 'Juggling', 99999);

  assert.strictEqual(none.status, 400);
  assert.match(none.text, /Choose a category/);
  assert.strictEqual(fake.status, 400);
  assert.strictEqual(findRow('skills', 'Juggling'), undefined);
});

// 15. INVALID INPUT: a refused skill form is refilled with the name and category
test('a refused skill form keeps the name and the chosen category', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const categoryId = addRow('categories', 'Outdoors');
  db.prepare('INSERT INTO skills (name, category_id) VALUES (?, ?)').run('Climbing', categoryId);

  // A copy of an existing skill, so the form is refused
  const response = await addSkill(admin, 'Climbing', categoryId);

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /value="Climbing"/);
  assert.match(response.text, new RegExp(`value="${categoryId}" selected`));
});

// 16. NORMAL CASE: removing a category keeps its skills, with no category
test('removing a category keeps its skills, now with no category', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const categoryId = addRow('categories', 'Temporary');
  db.prepare('INSERT INTO skills (name, category_id) VALUES (?, ?)').run('Knitting', categoryId);

  const response = await admin.post(`/admin/categories/${categoryId}/remove`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(findRow('categories', 'Temporary'), undefined);
  const skill = db.prepare('SELECT category_id FROM skills WHERE name = ?').get('Knitting');
  assert.strictEqual(skill.category_id, null);

  // The skills page says so
  const page = await admin.get('/admin/skills');
  assert.match(page.text, /Knitting\s*<span class="hint">&middot; No category<\/span>/);
});

// 17. NORMAL CASE: removing a skill also removes everyone's ticks for it
test('removing a skill also removes the ticks for it', async () => {
  const admin = await loginAs(app, { isAdmin: true });
  const skillId = addRow('skills', 'Origami');
  const student = createUser();
  db.prepare("INSERT INTO user_skills (user_id, skill_id, kind) VALUES (?, ?, 'has')").run(student.id, skillId);

  await admin.post(`/admin/skills/${skillId}/remove`);

  assert.strictEqual(findRow('skills', 'Origami'), undefined);
  const ticks = db.prepare('SELECT COUNT(*) AS total FROM user_skills WHERE skill_id = ?').get(skillId);
  assert.strictEqual(ticks.total, 0);
});
