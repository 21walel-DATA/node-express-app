// routes/home.js
// Routes for the home page.
// A "router" is a mini Express app that holds a group of related routes.
// app.js plugs each router into the main app.

const express = require('express');

const router = express.Router();

// ---------------------------------------------------------
// HOME ROUTES
// ---------------------------------------------------------

// 1. HOME: The page a user lands on after logging in.
// app.js puts this router below the login check, so only logged-in users
// reach it. Feature 03 turns it into the dashboard.
router.get('/', (req, res) => {
  // res.render fills in the views/home.ejs template and sends the HTML
  res.render('home');
});

// Share the router with app.js
module.exports = router;
