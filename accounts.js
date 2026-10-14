// accounts.js
// Shared code for user accounts. Any file that needs it writes:
//   const { deleteUser } = require('./accounts');
//
// Two features use deleteUser, so it lives here and is written once:
//   - feature 05: an admin removes an account (routes/admin.js)
//   - feature 06: a student deletes their own account (the Account page)
// Both must delete exactly the same things (PRD section 4.6).

const db = require('./db');

// ---------------------------------------------------------
// 1. DELETE A USER
// ---------------------------------------------------------

// Deletes one user and everything that belongs to them.
// Returns true if the user was deleted, or false if there was no user
// with that id (for example, they were already deleted).
//
// One DELETE is enough, because schema.sql uses ON DELETE CASCADE: deleting
// the users row makes SQLite also delete the rows that point at it:
//   - their "looking for" ticks, skills and interests (their profile)
//   - their connection requests, sent and received
//   - the messages in those conversations, and any message they sent
// SQLite does all of this as one step: either everything is deleted or,
// if something goes wrong, nothing is.
//
// If they are logged in somewhere, they are logged out on their next page
// load: loadCurrentUser in middleware/auth.js finds no user for the id in
// their session, and forgets it.
//
// TODO (feature 07, photo upload): also delete their photo file from the
// volume here, so every way of deleting an account removes it.
function deleteUser(userId) {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  // result.changes is how many rows the DELETE removed: 1 or 0
  return result.changes === 1;
}

// Share the function with the routes and the tests
module.exports = { deleteUser };
