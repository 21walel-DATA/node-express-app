// routes/admin.js
// Routes for the admin pages (PRD section 4.5).
// app.js plugs this router in at /admin, behind the login check AND the
// admin check, so every route in this file is for admins only.
// Because of that, the addresses below are written without "/admin":
// router.get('/') here answers the address /admin.

const express = require('express');

const router = express.Router();

// ---------------------------------------------------------
// ADMIN ROUTES
// ---------------------------------------------------------

// 1. ADMIN HOME: The starting page for admins, linking to each admin section
router.get('/', (req, res) => {
  res.render('admin');
});

// Share the router with app.js
module.exports = router;
