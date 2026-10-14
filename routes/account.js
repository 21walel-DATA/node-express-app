// routes/account.js
// Routes for feature 06, the Account page (see specs/06-account.md).
// For now this shows the page. Saving the forms comes in the next steps.

const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

// Shows the Account page. Used for a normal visit and, in later steps,
// again when a form was refused.
//   errors  messages to show when a form was refused
//   values  what to put in the details boxes (name, email)
//   status  200 (OK) or 400 (Bad Request)
function renderAccount(res, { errors = [], values, status = 200 } = {}) {
  // currentUser (from middleware/auth.js) leaves the email out on purpose,
  // so it is not carried around on every page. Read it here instead.
  const saved = db
    .prepare('SELECT name, email FROM users WHERE id = ?')
    .get(res.locals.currentUser.id);

  res.status(status).render('account', {
    errors,
    // Normally the saved name and email
    values: values || saved,
  });
}

// ---------------------------------------------------------
// ACCOUNT ROUTES
// ---------------------------------------------------------

// 1. ACCOUNT PAGE: the logged-in user's own settings.
// There is no id in the address: the page always belongs to the logged-in
// user, so nobody can open someone else's. app.js puts this router below
// the login check and the setup gate.
router.get('/account', (req, res) => {
  renderAccount(res);
});

// Share the router with app.js
module.exports = router;
