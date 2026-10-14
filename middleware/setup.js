// middleware/setup.js
// The setup gate (feature 02, see specs/02-profiles.md).
// A "middleware" is a function that runs BEFORE a route. It either calls
// next() to let the request carry on, or answers it itself (for example by
// redirecting) so the route never runs.

// The one address a user who has not finished setup may open.
// (Showing the form and saving it both use this address.)
const SETUP_FORM = '/profile/edit';

// 1. REQUIRE SETUP: Send users who have not finished setup to the form.
// Must run after requireLogin, so res.locals.currentUser is always set.
// app.js puts it there. The privacy notice, login, logout and the files in
// public/ are plugged in ABOVE requireLogin, so they never reach this gate
// and stay open to everyone.
function requireSetup(req, res, next) {
  // setup_complete is 1 once the profile form has been saved
  if (res.locals.currentUser.setup_complete === 1) {
    return next();
  }

  // Not finished yet, but they are on the form: let them fill it in.
  // req.path is the address without anything after a "?".
  if (req.path === SETUP_FORM) {
    return next();
  }

  // Anywhere else: go and finish setup first
  res.redirect(SETUP_FORM);
}

module.exports = { requireSetup };
