// tests/seed.test.js
// Tests that the seed script fills the database with the starter lists
// and the made-up students we agreed.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');

// Load the helper first so the throwaway in-memory database is used
require('./helpers');
const db = require('../db');

// The seed script gives us two functions: seed() fills the database, and
// seedOnStartup() does the same only when SEED_DEMO_DATA is 'true'.
// The { } pick those two out of the object the file shares.
const { seed, seedOnStartup } = require('../scripts/seed');

// Counts the rows in a table and returns the number.
// The table name is typed by us below, never by a user, so it is safe to
// put it straight into the SQL text here.
function countRows(table) {
  return db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;
}

// Fill the database once, before any of the tests below run
seed();

// ---------------------------------------------------------
// SEED SCRIPT
// ---------------------------------------------------------

// 1. NORMAL CASE: the lists are filled, and every skill has a category
test('the categories, skills and interests lists are filled', () => {
  // The numbers agreed on 13 October 2026
  assert.strictEqual(countRows('categories'), 5);
  assert.strictEqual(countRows('skills'), 17);
  assert.strictEqual(countRows('interests'), 10);

  // A skill with no category would not show under any heading on the form
  const loose = db
    .prepare('SELECT COUNT(*) AS total FROM skills WHERE category_id IS NULL')
    .get();
  assert.strictEqual(loose.total, 0);
});

// 2. NORMAL CASE: there are made-up students on both courses
test('there are four made-up students on each course', () => {
  // GROUP BY makes one result row per course, with a count of its students
  const rows = db
    .prepare('SELECT course_id, COUNT(*) AS total FROM users GROUP BY course_id')
    .all();

  // Two courses, so two result rows
  assert.strictEqual(rows.length, 2);

  for (const row of rows) {
    assert.strictEqual(row.total, 4, `course ${row.course_id} should have 4 students`);
  }
});

// 3. NORMAL CASE: every made-up student has finished the required setup
test('every made-up student has finished setup', () => {
  const users = db.prepare('SELECT id, name, setup_complete FROM users').all();

  // One prepared statement for each kind of tick. The ? is filled in with
  // the student's id each time we use it.
  const lookingFor = db.prepare(
    'SELECT COUNT(*) AS total FROM user_looking_for WHERE user_id = ?'
  );
  const skills = db.prepare(
    'SELECT COUNT(*) AS total FROM user_skills WHERE user_id = ? AND kind = ?'
  );
  const interests = db.prepare(
    'SELECT COUNT(*) AS total FROM user_interests WHERE user_id = ?'
  );

  for (const user of users) {
    assert.strictEqual(user.setup_complete, 1, `${user.name} has not finished setup`);

    // At least one of each required tick
    assert.ok(lookingFor.get(user.id).total >= 1, `${user.name} has no "looking for" tick`);
    assert.ok(skills.get(user.id, 'has').total >= 1, `${user.name} has no skill they have`);
    assert.ok(skills.get(user.id, 'wants').total >= 1, `${user.name} has no skill they want`);
    assert.ok(interests.get(user.id).total >= 1, `${user.name} has no interest`);
  }
});

// 4. NORMAL CASE: running the seed a second time does not make copies
test('running the seed twice does not make copies', () => {
  // Every table the seed script writes to
  const tables = [
    'categories',
    'skills',
    'interests',
    'users',
    'user_looking_for',
    'user_skills',
    'user_interests',
  ];

  // Write down how many rows each table has now
  const before = tables.map(countRows);

  // Run the seed again, then count again
  seed();
  const after = tables.map(countRows);

  // deepStrictEqual compares two lists item by item
  assert.deepStrictEqual(after, before);
});

// 5. NO PERMISSION: without a demo password, nobody can log in as a made-up student
test('without a password, no password works for the made-up students', () => {
  // The seed at the top of this file was run with no password
  const users = db.prepare('SELECT name, password_hash FROM users').all();

  for (const user of users) {
    // bcrypt.compareSync is the same check the login route makes. It
    // answers true only when the typed password matches the hash.
    assert.strictEqual(
      bcrypt.compareSync('any-guess', user.password_hash),
      false,
      `someone could log in as ${user.name}`
    );
  }
});

// 6. NORMAL CASE: with a demo password, every made-up student can log in
test('with a password, every made-up student can log in with it', () => {
  // INSERT OR IGNORE never changes a student who is already there, so
  // start again. ON DELETE CASCADE also removes everything they ticked.
  db.prepare('DELETE FROM users').run();

  seed('demo-password');

  const users = db.prepare('SELECT name, password_hash FROM users').all();
  assert.strictEqual(users.length, 8);

  for (const user of users) {
    // The real password must never be stored, only its hash
    assert.notStrictEqual(user.password_hash, 'demo-password');

    // The right password works and a wrong one does not
    assert.ok(
      bcrypt.compareSync('demo-password', user.password_hash),
      `${user.name} cannot log in with the demo password`
    );
    assert.strictEqual(bcrypt.compareSync('wrong-password', user.password_hash), false);
  }
});

// 7. NORMAL CASE: at startup, nothing is seeded unless SEED_DEMO_DATA is 'true'
test('seedOnStartup does nothing unless SEED_DEMO_DATA is "true"', () => {
  // Start with no students, so we can see whether any are added
  db.prepare('DELETE FROM users').run();

  // Each { } is a pretend list of environment variables
  assert.strictEqual(seedOnStartup({}), false);
  assert.strictEqual(seedOnStartup({ SEED_DEMO_DATA: 'false' }), false);
  assert.strictEqual(seedOnStartup({ SEED_DEMO_DATA: 'yes' }), false);

  assert.strictEqual(countRows('users'), 0);
});

// 8. NORMAL CASE: at startup, SEED_DEMO_DATA 'true' adds the made-up students
test('seedOnStartup seeds when SEED_DEMO_DATA is "true"', () => {
  db.prepare('DELETE FROM users').run();

  assert.strictEqual(seedOnStartup({ SEED_DEMO_DATA: 'true' }), true);

  assert.strictEqual(countRows('users'), 8);
});
