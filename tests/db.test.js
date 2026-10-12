// tests/db.test.js
// Tests that schema.sql builds the database we expect.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');

// Load the helper first so the throwaway in-memory database is used
require('./helpers');
const db = require('../db');

// Adds one user and returns their id. Used by the tests below.
function addUser(name, email) {
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, privacy_agreed_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    )
    .run(name, email, 'not-a-real-hash');
  return result.lastInsertRowid;
}

// ---------------------------------------------------------
// DATABASE SCHEMA
// ---------------------------------------------------------

// 1. NORMAL CASE: every table in schema.sql was created
test('all the tables exist', () => {
  // sqlite_master is SQLite's own list of what is in the database
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  const names = rows.map((row) => row.name);

  const expected = [
    'courses',
    'categories',
    'skills',
    'interests',
    'looking_for_options',
    'users',
    'user_looking_for',
    'user_skills',
    'user_interests',
    'connection_requests',
    'messages',
  ];

  for (const table of expected) {
    assert.ok(names.includes(table), `missing table: ${table}`);
  }
});

// 2. NORMAL CASE: the starting rows are there
test('the starting rows are added', () => {
  const courses = db.prepare('SELECT COUNT(*) AS total FROM courses').get();
  const options = db.prepare('SELECT COUNT(*) AS total FROM looking_for_options').get();

  assert.strictEqual(courses.total, 2);
  assert.strictEqual(options.total, 5);
});

// 3. BAD INPUT: two accounts cannot share an email, whatever the capitals
test('a duplicate email is refused', () => {
  addUser('Sam', 'sam@example.com');

  // assert.throws passes only if the code inside it fails
  assert.throws(() => addUser('Other Sam', 'SAM@example.com'), /UNIQUE/);
});

// 4. BAD INPUT: a user cannot send a connection request to themselves
test('a request to yourself is refused', () => {
  const id = addUser('Alex', 'alex@example.com');

  assert.throws(
    () =>
      db
        .prepare('INSERT INTO connection_requests (sender_id, receiver_id) VALUES (?, ?)')
        .run(id, id),
    /CHECK/
  );
});

// 5. NORMAL CASE: deleting a user also deletes their requests and messages
test('deleting a user removes their requests and messages', () => {
  const senderId = addUser('Jo', 'jo@example.com');
  const receiverId = addUser('Kim', 'kim@example.com');

  // Jo sends Kim a request, then a message in that conversation
  const request = db
    .prepare('INSERT INTO connection_requests (sender_id, receiver_id) VALUES (?, ?)')
    .run(senderId, receiverId);
  db.prepare('INSERT INTO messages (request_id, sender_id, body) VALUES (?, ?, ?)').run(
    request.lastInsertRowid,
    senderId,
    'Hello'
  );

  // Delete Jo
  db.prepare('DELETE FROM users WHERE id = ?').run(senderId);

  const requests = db
    .prepare('SELECT COUNT(*) AS total FROM connection_requests WHERE sender_id = ?')
    .get(senderId);
  const messages = db
    .prepare('SELECT COUNT(*) AS total FROM messages WHERE request_id = ?')
    .get(request.lastInsertRowid);

  assert.strictEqual(requests.total, 0);
  assert.strictEqual(messages.total, 0);
});
