// routes/connections.js
// Routes for feature 04, connection requests (see specs/04-messaging.md).
// For now this holds the Connections page and the "send a request"
// button's route. Accept and decline come in the next build step.

const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------
// CONNECTION ROUTES
// ---------------------------------------------------------

// 1. CONNECTIONS PAGE: three lists for the logged-in user.
// Every list only ever looks at requests where the logged-in user is the
// sender or the receiver, so nobody sees other people's requests.
// The email is never selected, so it can never reach the page.
router.get('/connections', (req, res) => {
  const userId = res.locals.currentUser.id;

  // Requests TO you that are still waiting. The other person is the sender.
  // Newest first. Declined ones are left out: you already said no.
  const received = db
    .prepare(
      `SELECT users.id, users.name, courses.name AS course
       FROM connection_requests
       JOIN users ON users.id = connection_requests.sender_id
       LEFT JOIN courses ON courses.id = users.course_id
       WHERE connection_requests.receiver_id = ?
         AND connection_requests.status = 'pending'
       ORDER BY connection_requests.created_at DESC, connection_requests.id DESC`
    )
    .all(userId);

  // Requests FROM you that are not accepted. The other person is the
  // receiver. Declined ones stay here too, so the sender is never told "no"
  // (decision 2 in specs/04-messaging.md).
  const sent = db
    .prepare(
      `SELECT users.id, users.name, courses.name AS course
       FROM connection_requests
       JOIN users ON users.id = connection_requests.receiver_id
       LEFT JOIN courses ON courses.id = users.course_id
       WHERE connection_requests.sender_id = ?
         AND connection_requests.status IN ('pending', 'declined')
       ORDER BY connection_requests.created_at DESC, connection_requests.id DESC`
    )
    .all(userId);

  // Accepted requests, whoever asked. CASE works like an "if" inside SQL:
  // if you are the sender, the other person is the receiver, and the other
  // way round. A to Z by name.
  const connected = db
    .prepare(
      `SELECT users.id, users.name, courses.name AS course
       FROM connection_requests
       JOIN users ON users.id = CASE
         WHEN connection_requests.sender_id = ? THEN connection_requests.receiver_id
         ELSE connection_requests.sender_id
       END
       LEFT JOIN courses ON courses.id = users.course_id
       WHERE connection_requests.status = 'accepted'
         AND (connection_requests.sender_id = ? OR connection_requests.receiver_id = ?)
       ORDER BY users.name`
    )
    .all(userId, userId, userId);

  res.render('connections', { received, sent, connected });
});

// 2. SEND A REQUEST: the "Send connection request" button on a profile.
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
