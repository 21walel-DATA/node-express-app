// routes/connections.js
// Routes for feature 04, connection requests (see specs/04-messaging.md).
// For now this holds the "send a request" button's route. The Connections
// page, accept and decline come in the next build steps.

const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------
// CONNECTION ROUTES
// ---------------------------------------------------------

// 1. SEND A REQUEST: the "Send connection request" button on a profile.
// It is a POST (a form), not a link, because it changes data.
// app.js puts this router below the login check and the setup gate, so only
// logged-in users who finished setup reach it.
router.post('/connections/request/:userId', (req, res) => {
  const currentUser = res.locals.currentUser;

  // Only accept whole numbers, the same as the profile page does
  if (!/^\d+$/.test(req.params.userId)) {
    return res.status(404).render('profile', { profile: null });
  }
  const receiverId = Number(req.params.userId);

  // The person must exist and have finished setup. Otherwise their profile
  // is "not found", so they cannot be asked either.
  const receiver = db
    .prepare('SELECT id FROM users WHERE id = ? AND setup_complete = 1')
    .get(receiverId);
  if (!receiver) {
    return res.status(404).render('profile', { profile: null });
  }

  // Every answer below sends the user back to that profile, which always
  // shows the true status (for example "Request sent")
  const backToProfile = `/profile/${receiverId}`;

  // Rule: you cannot ask yourself. (The database refuses this too, but
  // checking first means no error.)
  if (receiverId === currentUser.id) {
    return res.redirect(backToProfile);
  }

  // Rule: one request per pair, ever (decision, 14 October 2026).
  // Look for ANY request between the two people, either way round and
  // whatever its status: waiting, accepted or declined.
  const existing = db
    .prepare(
      `SELECT id FROM connection_requests
       WHERE (sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?)`
    )
    .get(currentUser.id, receiverId, receiverId, currentUser.id);
  if (existing) {
    return res.redirect(backToProfile);
  }

  // All checks passed: save the request. Its status starts as 'pending'
  // (waiting), the default in schema.sql.
  db.prepare('INSERT INTO connection_requests (sender_id, receiver_id) VALUES (?, ?)').run(
    currentUser.id,
    receiverId
  );

  // Post/Redirect/Get: after saving, send the browser to a normal page, so
  // refreshing it does not send the request again
  res.redirect(backToProfile);
});

// Share the router with app.js
module.exports = router;
