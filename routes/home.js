// routes/home.js
// Routes for the home page.
// A "router" is a mini Express app that holds a group of related routes.
// app.js plugs each router into the main app.

const express = require('express');

const router = express.Router();

// ---------------------------------------------------------
// HOME ROUTES
// ---------------------------------------------------------

// 1. HOME: A simple page that proves the server is running.
router.get('/', (req, res) => {
  res.json({ message: 'Bootcamp Connect is running' });
});

// Share the router with app.js
module.exports = router;
