// middleware/auth.js
// Middleware about who is logged in.
// A "middleware" is a function that runs BEFORE a route. It receives the
// request, can look at it or add to it, and then either calls next() to
// let the request carry on, or answers it itself (for example by
// redirecting) so the route never runs.

const db = require('../db');

// 1. LOAD CURRENT USER: Work out who is making this request.
// Runs on every request. Afterwards res.locals.currentUser is either the
// logged-in user's row or null. Anything on res.locals can be read by
// routes (res.locals.currentUser) and by every EJS page (currentUser).
function loadCurrentUser(req, res, next) {
  // Start by assuming nobody is logged in
  res.locals.currentUser = null;

  // The login route saved the user's id in the session
  if (req.session.userId) {
    // Fetch the user fresh on every request, so a change (such as
    // finishing setup, or the account being deleted) takes effect at once.
    // Only the columns pages need are read; never the password hash.
    const user = db
      .prepare('SELECT id, name, is_admin, setup_complete FROM users WHERE id = ?')
      .get(req.session.userId);

    if (user) {
      res.locals.currentUser = user;
    } else {
      // The session points at an account that no longer exists (it was
      // deleted). Forget the id, so this browser counts as logged out.
      delete req.session.userId;
    }
  }

  next();
}

// 2. REQUIRE LOGIN: Stop anyone who is not logged in.
// Must run after loadCurrentUser. app.js switches it on for every page
// except register, login and the privacy notice.
function requireLogin(req, res, next) {
  if (!res.locals.currentUser) {
    // Not logged in: send the browser to the login page instead
    return res.redirect('/login');
  }

  // Logged in: let the request carry on to its route
  next();
}

module.exports = { loadCurrentUser, requireLogin };
