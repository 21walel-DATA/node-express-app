// routes/privacy.js
// Route for the privacy notice page.
// This page must be readable WITHOUT logging in, because people have to be
// able to read it before they agree to it on the registration form.

const express = require('express');

const router = express.Router();

// ---------------------------------------------------------
// PRIVACY NOTICE ROUTES
// ---------------------------------------------------------

// 1. PRIVACY NOTICE: Show the notice that every user agrees to at sign-up.
router.get('/privacy', (req, res) => {
  // The text lives in views/privacy.ejs, so it can be edited without
  // touching any JavaScript
  res.render('privacy');
});

// Share the router with app.js
module.exports = router;
