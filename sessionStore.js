// sessionStore.js
// Saves login sessions in the SQLite "sessions" table (see schema.sql).
//
// express-session remembers who is logged in. By default it keeps that
// information in the server's memory, which is lost on every restart.
// A "store" tells it to keep the information somewhere else. This file is
// our store: three small functions that express-session calls for us.
//   get(sid)      read one session
//   set(sid, ...) save one session
//   destroy(sid)  delete one session (used at logout)
// "sid" is the session id: the random text kept in the browser's cookie.

const session = require('express-session');
const db = require('./db');

// How long a session lasts when its cookie has no expiry date: one day,
// written in milliseconds (24 hours x 60 minutes x 60 seconds x 1000)
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// "extends session.Store" means: start from express-session's basic store
// and add our own get, set and destroy to it.
class SqliteStore extends session.Store {
  constructor() {
    // super() runs the set-up code of session.Store itself
    super();

    // Tidy up: remove sessions that ran out while the app was not looking.
    // This runs once, each time the app starts.
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  }

  // 1. GET: Find one session by its id.
  // callback is a function express-session gives us. We call it with
  // (error, result) when we are done: that is how it receives the answer.
  get(sid, callback) {
    try {
      // Only return the session if it has not expired yet
      const row = db
        .prepare('SELECT data FROM sessions WHERE sid = ? AND expires_at > ?')
        .get(sid, Date.now());

      // No row means "no such session", which is not an error
      if (!row) {
        return callback(null, null);
      }

      // The data was saved as JSON text, so turn it back into an object
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  // 2. SET: Save a session, replacing the old copy if there is one.
  set(sid, sessionData, callback) {
    try {
      // The cookie knows when it expires. Use the same moment for the row,
      // or one day from now if the cookie has no expiry date.
      const cookieExpires = sessionData.cookie && sessionData.cookie.expires;
      const expiresAt = cookieExpires
        ? new Date(cookieExpires).getTime()
        : Date.now() + ONE_DAY_MS;

      // INSERT OR REPLACE: add the row, or overwrite the row with the same sid
      db.prepare(
        'INSERT OR REPLACE INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)'
      ).run(sid, JSON.stringify(sessionData), expiresAt);

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  // 3. DESTROY: Delete a session. This is what logging out does.
  destroy(sid, callback) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

// Share the store with app.js
module.exports = SqliteStore;
