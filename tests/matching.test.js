// tests/matching.test.js
// Tests for findMatches() in matching.js (scoring rules in PRD section 4.3).
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');

// Load the helper first so the throwaway in-memory database is used
require('./helpers');
const db = require('../db');
const { findMatches } = require('../matching');

// ---------------------------------------------------------
// TEST DATA
// ---------------------------------------------------------

// A few skills and interests for the tests to tick.
// INSERT OR IGNORE skips any that are already there.
for (const name of ['Sales', 'JavaScript', 'Branding']) {
  db.prepare('INSERT OR IGNORE INTO skills (name) VALUES (?)').run(name);
}
for (const name of ['Fintech', 'Gaming']) {
  db.prepare('INSERT OR IGNORE INTO interests (name) VALUES (?)').run(name);
}

// Looks up the id of a row by its name or code, so the tests can use
// readable names like 'Sales' instead of id numbers
function skillId(name) {
  return db.prepare('SELECT id FROM skills WHERE name = ?').get(name).id;
}
function interestId(name) {
  return db.prepare('SELECT id FROM interests WHERE name = ?').get(name).id;
}
function optionId(code) {
  return db.prepare('SELECT id FROM looking_for_options WHERE code = ?').get(code).id;
}

// Adds one user with a profile and returns their id.
// profile can hold any of these (all optional):
//   lookingFor: ['cofounder', ...]   has: ['Sales', ...]
//   wants: ['JavaScript', ...]       interests: ['Gaming', ...]
//   setupComplete: false             isAdmin: true
function addUser(name, profile = {}) {
  // Make an email from the name, e.g. 'Ada Lane' -> 'ada-lane@example.com'
  const email = name.toLowerCase().replace(/ /g, '-') + '@example.com';

  // Setup is finished unless the test says otherwise.
  // SQLite stores yes/no as 1/0.
  const setupComplete = profile.setupComplete === false ? 0 : 1;
  const isAdmin = profile.isAdmin ? 1 : 0;

  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, setup_complete, is_admin, privacy_agreed_at)
       VALUES (?, ?, 'not-a-real-hash', ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(name, email, setupComplete, isAdmin);
  const id = result.lastInsertRowid;

  // Tick each item in the profile. "|| []" means "or an empty list if the
  // test left it out", so the loops simply do nothing.
  for (const code of profile.lookingFor || []) {
    db.prepare('INSERT INTO user_looking_for (user_id, option_id) VALUES (?, ?)').run(id, optionId(code));
  }
  for (const skill of profile.has || []) {
    db.prepare("INSERT INTO user_skills (user_id, skill_id, kind) VALUES (?, ?, 'has')").run(id, skillId(skill));
  }
  for (const skill of profile.wants || []) {
    db.prepare("INSERT INTO user_skills (user_id, skill_id, kind) VALUES (?, ?, 'wants')").run(id, skillId(skill));
  }
  for (const interest of profile.interests || []) {
    db.prepare('INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)').run(id, interestId(interest));
  }

  return id;
}

// Every test starts with no users. Deleting a user also deletes their
// ticks, because of ON DELETE CASCADE in schema.sql.
test.beforeEach(() => {
  db.prepare('DELETE FROM users').run();
});

// ---------------------------------------------------------
// SCORING
// ---------------------------------------------------------

// 1. NORMAL CASE: a skill the user wants, that the other person has, is 3 points
test('a wanted skill the other person has scores 3 points with a reason', () => {
  const me = addUser('Me', { wants: ['Sales'] });
  addUser('Ben Seller', { has: ['Sales'] });

  const matches = findMatches(me);

  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].name, 'Ben Seller');
  assert.strictEqual(matches[0].score, 3);
  assert.deepStrictEqual(matches[0].reasons, ['Has a skill you are looking for: Sales']);
});

// 2. NORMAL CASE: two wanted skills are 3 points each
test('each wanted skill adds 3 points', () => {
  const me = addUser('Me', { wants: ['Sales', 'JavaScript'] });
  addUser('Ben Both', { has: ['Sales', 'JavaScript'] });

  assert.strictEqual(findMatches(me)[0].score, 6);
});

// 3. EDGE CASE: it only counts one way. The user HAVING a skill the other
// person wants does not score for the user (it scores on their dashboard).
test('a skill the user has, but does not want, scores nothing', () => {
  const me = addUser('Me', { has: ['Sales'] });
  addUser('Ben Buyer', { wants: ['Sales'] });

  assert.deepStrictEqual(findMatches(me), []);
});

// 4. NORMAL CASE: both looking for a co-founder is a fit, worth 2 points
test('both ticking the same "looking for" option scores 2 points', () => {
  const me = addUser('Me', { lookingFor: ['cofounder'] });
  addUser('Cleo Founder', { lookingFor: ['cofounder'] });

  const matches = findMatches(me);

  assert.strictEqual(matches[0].score, 2);
  assert.deepStrictEqual(matches[0].reasons, ['You are both looking for a co-founder']);
});

// 5. NORMAL CASE (roadmap finish line): "Find a mentor" fits "Be a mentor"
test('a user looking for a mentor sees a "be a mentor" user as a fit', () => {
  const me = addUser('Me', { lookingFor: ['find_mentor'] });
  addUser('Mo Mentor', { lookingFor: ['be_mentor'] });

  const matches = findMatches(me);

  assert.strictEqual(matches[0].name, 'Mo Mentor');
  assert.strictEqual(matches[0].score, 2);
  assert.deepStrictEqual(matches[0].reasons, ['You are looking for a mentor and they want to be one']);
});

// 6. NORMAL CASE: the mentor fit also works the other way round
test('a would-be mentor sees a user looking for a mentor as a fit', () => {
  const me = addUser('Me', { lookingFor: ['be_mentor'] });
  addUser('Lee Learner', { lookingFor: ['find_mentor'] });

  const matches = findMatches(me);

  assert.strictEqual(matches[0].score, 2);
  assert.deepStrictEqual(matches[0].reasons, ['You want to be a mentor and they are looking for one']);
});

// 7. EDGE CASE: both "find a mentor" is not a fit (nobody is the mentor)
test('two users both looking for a mentor are not a fit', () => {
  const me = addUser('Me', { lookingFor: ['find_mentor'] });
  addUser('Lee Learner', { lookingFor: ['find_mentor'] });

  assert.deepStrictEqual(findMatches(me), []);
});

// 8. NORMAL CASE: a shared interest is 1 point
test('a shared interest scores 1 point', () => {
  const me = addUser('Me', { interests: ['Gaming'] });
  addUser('Gil Gamer', { interests: ['Gaming'] });

  const matches = findMatches(me);

  assert.strictEqual(matches[0].score, 1);
  assert.deepStrictEqual(matches[0].reasons, ['You are both interested in Gaming']);
});

// 9. NORMAL CASE: all three rules add up, with one reason per point-earner
test('skills, fits and interests add up, with a reason for each', () => {
  const me = addUser('Me', { wants: ['Sales'], lookingFor: ['social'], interests: ['Fintech'] });
  addUser('Ali All', { has: ['Sales'], lookingFor: ['social'], interests: ['Fintech'] });

  const matches = findMatches(me);

  // 3 (skill) + 2 (fit) + 1 (interest) = 6
  assert.strictEqual(matches[0].score, 6);
  assert.deepStrictEqual(matches[0].reasons, [
    'Has a skill you are looking for: Sales',
    'You both want to meet people socially',
    'You are both interested in Fintech',
  ]);
});

// ---------------------------------------------------------
// WHO APPEARS
// ---------------------------------------------------------

// 10. EDGE CASE (roadmap finish line): the user never matches themselves,
// even when they have a skill they also want
test('the user never appears in their own matches', () => {
  const me = addUser('Me', { has: ['Sales'], wants: ['Sales'], interests: ['Gaming'] });

  assert.deepStrictEqual(findMatches(me), []);
});

// 11. EDGE CASE: people who have not finished setup are left out
test('a user who has not finished setup does not appear', () => {
  const me = addUser('Me', { wants: ['Sales'] });
  addUser('Una Unfinished', { has: ['Sales'], setupComplete: false });

  assert.deepStrictEqual(findMatches(me), []);
});

// 12. EDGE CASE: admins are not students, so they are left out
test('an admin does not appear in matches', () => {
  const me = addUser('Me', { wants: ['Sales'] });
  addUser('Ada Admin', { has: ['Sales'], isAdmin: true });

  assert.deepStrictEqual(findMatches(me), []);
});

// 13. EDGE CASE (roadmap finish line): nobody in common gives an empty list,
// which the dashboard will show as "No matches yet"
test('nobody with anything in common gives an empty list', () => {
  const me = addUser('Me', { wants: ['Sales'], interests: ['Gaming'] });
  addUser('Nia Nothing', { has: ['Branding'], interests: ['Fintech'] });

  assert.deepStrictEqual(findMatches(me), []);
});

// 14. SECURITY: email addresses are never part of a match
test('matches do not include email addresses', () => {
  const me = addUser('Me', { wants: ['Sales'] });
  addUser('Ben Seller', { has: ['Sales'] });

  assert.strictEqual(findMatches(me)[0].email, undefined);
});

// ---------------------------------------------------------
// ORDER AND LIMIT
// ---------------------------------------------------------

// 15. NORMAL CASE: best first, ties in name order, and only the top 5
test('returns the top 5, highest score first, ties in name order', () => {
  const me = addUser('Me', { wants: ['Sales', 'JavaScript'], lookingFor: ['cofounder'], interests: ['Gaming'] });

  addUser('Seven Points', { has: ['Sales', 'JavaScript'], interests: ['Gaming'] }); // 3 + 3 + 1
  addUser('Five Points', { has: ['Sales'], lookingFor: ['cofounder'] }); // 3 + 2
  addUser('Bea Three', { has: ['Sales'] }); // 3, ties with Cal
  addUser('Cal Three', { has: ['JavaScript'] }); // 3
  addUser('Two Points', { lookingFor: ['cofounder'] }); // 2
  addUser('One Point', { interests: ['Gaming'] }); // 1, sixth, so left out

  const matches = findMatches(me);

  // map picks out just the names, to compare the order in one go
  assert.deepStrictEqual(
    matches.map((match) => match.name),
    ['Seven Points', 'Five Points', 'Bea Three', 'Cal Three', 'Two Points']
  );
});
