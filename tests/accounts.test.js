// tests/accounts.test.js
// Tests for the shared deleteUser function in accounts.js.
// (Feature 06, the Account page, will reuse it, so these tests check that
// it deletes everything PRD section 4.6 lists.)
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');

// Load the helper first so the throwaway in-memory database is used
require('./helpers');
const db = require('../db');
const { createUser } = require('./loginHelper');
const { deleteUser } = require('../accounts');

// Counts the rows in a table that match a condition.
// The table and condition are typed by us below, never by a user.
function count(table, where, ...values) {
  return db.prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`).get(...values).total;
}

// ---------------------------------------------------------
// DELETE A USER
// ---------------------------------------------------------

// 1. NORMAL CASE: the user and everything that belongs to them is deleted
test('deleteUser deletes the user, their profile, requests and messages', () => {
  const ada = createUser({ name: 'Ada Leaving' });
  const ben = createUser({ name: 'Ben Staying' });

  // Give Ada a profile: a "looking for" tick, a skill and an interest
  const optionId = db.prepare("SELECT id FROM looking_for_options WHERE code = 'social'").get().id;
  db.prepare('INSERT INTO user_looking_for (user_id, option_id) VALUES (?, ?)').run(ada.id, optionId);
  const skillId = db.prepare("INSERT INTO skills (name) VALUES ('Deleting skill')").run().lastInsertRowid;
  db.prepare("INSERT INTO user_skills (user_id, skill_id, kind) VALUES (?, ?, 'has')").run(ada.id, skillId);
  const interestId = db.prepare("INSERT INTO interests (name) VALUES ('Deleting interest')").run().lastInsertRowid;
  db.prepare('INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)').run(ada.id, interestId);

  // A conversation between Ada and Ben, with a message from each
  const requestId = db
    .prepare("INSERT INTO connection_requests (sender_id, receiver_id, status) VALUES (?, ?, 'accepted')")
    .run(ada.id, ben.id).lastInsertRowid;
  db.prepare('INSERT INTO messages (request_id, sender_id, body) VALUES (?, ?, ?)').run(requestId, ada.id, 'Hi Ben');
  db.prepare('INSERT INTO messages (request_id, sender_id, body) VALUES (?, ?, ?)').run(requestId, ben.id, 'Hi Ada');

  const result = deleteUser(ada.id);

  assert.strictEqual(result, true);
  assert.strictEqual(count('users', 'id = ?', ada.id), 0);
  assert.strictEqual(count('user_looking_for', 'user_id = ?', ada.id), 0);
  assert.strictEqual(count('user_skills', 'user_id = ?', ada.id), 0);
  assert.strictEqual(count('user_interests', 'user_id = ?', ada.id), 0);
  assert.strictEqual(count('connection_requests', 'id = ?', requestId), 0);
  // Both messages go, including Ben's, because the conversation is gone
  // (PRD: deleting an account also deletes that person's conversations)
  assert.strictEqual(count('messages', 'request_id = ?', requestId), 0);
});

// 2. NORMAL CASE: other users are not touched
test('deleteUser leaves other users alone', () => {
  const leaving = createUser();
  const staying = createUser();

  deleteUser(leaving.id);

  assert.strictEqual(count('users', 'id = ?', staying.id), 1);
});

// 3. EDGE CASE: deleting someone who does not exist returns false
test('deleteUser returns false when there is no such user', () => {
  assert.strictEqual(deleteUser(99999), false);
});
