// routes/home.js
// Routes for the home page, which is the dashboard.
// A "router" is a mini Express app that holds a group of related routes.
// app.js plugs each router into the main app.

const express = require('express');

// findMatches works out the scores and reasons (see matching.js)
const { findMatches } = require('../matching');

const router = express.Router();

// ---------------------------------------------------------
// HOME ROUTES
// ---------------------------------------------------------

// 1. DASHBOARD: The page a user lands on after logging in. It shows their
// top 5 matches, each with the reasons they match (PRD section 4.3).
// app.js puts this router below the login check, so only logged-in users
// reach it, and res.locals.currentUser is always set.
router.get('/', (req, res) => {
  // Work the matches out fresh on every visit, so they always reflect
  // everyone's latest saved profile
  const matches = findMatches(res.locals.currentUser.id);

  // res.render fills in the views/home.ejs template and sends the HTML.
  // The { matches } object hands the list to the template.
  res.render('home', { matches });
});

// Share the router with app.js
module.exports = router;
