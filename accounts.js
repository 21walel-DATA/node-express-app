// accounts.js
// Shared code for user accounts. Any file that needs it writes:
//   const { deleteUser } = require('./accounts');
//
// Two features use deleteUser, so it lives here and is written once:
//   - feature 05: an admin removes an account (routes/admin.js)
//   - feature 06: a student deletes their own account (the Account page)
// Both must delete exactly the same things (PRD section 4.6).

const db = require('./db');
const { deletePhoto } = require('./photos');

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
// Their photo file (feature 07) is not in the database, so the cascade
// cannot reach it. It is deleted here instead, so every way of deleting an
// account removes it.
function deleteUser(userId) {
  // 1a. Note their photo's file name BEFORE the row (and the name) is gone.
  // "?." means "if there is no such user, give undefined instead of an error".
  const photoFilename = db
    .prepare('SELECT photo_filename FROM users WHERE id = ?')
    .get(userId)?.photo_filename;

  // 1b. Delete the user, and through the cascade everything listed above
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  // result.changes is how many rows the DELETE removed: 1 or 0
  if (result.changes === 0) {
    return false;
  }

  // 1c. Delete the photo file last, once the account is surely gone
  deletePhoto(photoFilename);
  return true;
}

// Share the function with the routes and the tests
module.exports = { deleteUser };
