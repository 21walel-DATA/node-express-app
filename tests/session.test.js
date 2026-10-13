// tests/session.test.js
// Tests for sessionStore.js, which saves login sessions in the database.
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');

// Load the helper first so the throwaway in-memory database is used
require('./helpers');
const db = require('../db');
const SqliteStore = require('../sessionStore');

const store = new SqliteStore();

// The store answers through callbacks. These small wrappers turn each call
// into a Promise, so the tests can use "await" and read top to bottom.
function getSession(sid) {
  return new Promise((resolve, reject) => {
    store.get(sid, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function setSession(sid, data) {
  return new Promise((resolve, reject) => {
    store.set(sid, data, (err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(sid) {
  return new Promise((resolve, reject) => {
    store.destroy(sid, (err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------
// SESSION STORE
// ---------------------------------------------------------

// 1. NORMAL CASE: what is saved can be read back
test('a saved session can be read back', async () => {
  // A session that expires one hour from now
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  await setSession('abc', { userId: 7, cookie: { expires: oneHourFromNow } });

  const data = await getSession('abc');

  assert.strictEqual(data.userId, 7);
});

// 2. NORMAL CASE: an id that was never saved gives nothing back
test('an unknown session id gives no session', async () => {
  const data = await getSession('does-not-exist');

  assert.strictEqual(data, null);
});

// 3. BAD INPUT: a session past its expiry time is treated as missing
test('an expired session gives no session', async () => {
  // A session that expired one hour ago
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await setSession('old', { userId: 7, cookie: { expires: oneHourAgo } });

  const data = await getSession('old');

  assert.strictEqual(data, null);
});

// 4. NORMAL CASE: destroying a session (logging out) removes its row
test('a destroyed session is removed from the database', async () => {
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  await setSession('bye', { userId: 7, cookie: { expires: oneHourFromNow } });

  await destroySession('bye');

  // Look in the table directly to prove the row is really gone
  const row = db.prepare('SELECT sid FROM sessions WHERE sid = ?').get('bye');
  assert.strictEqual(row, undefined);
});
