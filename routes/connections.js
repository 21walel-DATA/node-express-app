// routes/connections.js
// Routes for feature 04, connection requests (see specs/04-messaging.md).
// The Connections page, sending, accepting and declining requests, and the
// conversation page. Sending a message comes in the next build step.

const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

// Turns a time from the database into UK clock time for the page.
// '2026-10-14 20:51:09' -> '14 Oct 2026, 21:51'
// The database saves times in UTC (the same as UK winter time) as text.
// Adding 'T' and 'Z' turns that text into the standard way of writing a
// UTC time, so JavaScript reads it correctly. toLocaleString then shows it
// as a UK date ('en-GB') in UK time ('Europe/London'), which moves it on an
// hour in British Summer Time. Both are built into Node: no library.
function formatTime(databaseTime) {
  const time = new Date(databaseTime.replace(' ', 'T') + 'Z');
  return time.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  // requestId is needed for the Accept and Decline buttons.
  const received = db
    .prepare(
      `SELECT connection_requests.id AS requestId,
              users.id, users.name, courses.name AS course
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
  // requestId is also the conversation's number, for its link.
  const connected = db
    .prepare(
      `SELECT connection_requests.id AS requestId,
              users.id, users.name, courses.name AS course
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

// Answers a request: used by both the Accept and the Decline button.
// newStatus is 'accepted' or 'declined'.
// The rules are inside the UPDATE itself: it changes the request ONLY if
// it was sent to the logged-in user AND is still waiting. If anything is
// wrong (someone else's request, already answered, or no such request),
// no row fits, so nothing changes.
// Either way the user goes back to the Connections page, which always
// shows the true state.
function answerRequest(req, res, newStatus) {
  // Only whole numbers can be request ids
  if (/^\d+$/.test(req.params.id)) {
    db.prepare(
      `UPDATE connection_requests SET status = ?
       WHERE id = ? AND receiver_id = ? AND status = 'pending'`
    ).run(newStatus, Number(req.params.id), res.locals.currentUser.id);
  }

  res.redirect('/connections');
}

// 3. ACCEPT A REQUEST: the Accept button on the Connections page.
// ":id" is the request's id number.
router.post('/connections/:id/accept', (req, res) => {
  answerRequest(req, res, 'accepted');
});

// 4. DECLINE A REQUEST: the Decline button on the Connections page
router.post('/connections/:id/decline', (req, res) => {
  answerRequest(req, res, 'declined');
});

// 5. CONVERSATION PAGE: the messages between two connected people.
// ":id" is the accepted request's id number: one request, one conversation.
router.get('/conversations/:id', (req, res) => {
  const userId = res.locals.currentUser.id;

  // Only whole numbers can be conversation numbers.
  // Every "no" in this route shows the same "misdirected" page with 404, so
  // a snooper cannot tell "not yours" from "does not exist" (decision 4).
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).render('conversation-not-found');
  }
  const conversationId = Number(req.params.id);

  // The rules are inside the question, like answerRequest above: find this
  // request ONLY if it is accepted AND the logged-in user is one of its two
  // people. Anyone else gets nothing back.
  const conversation = db
    .prepare(
      `SELECT sender_id, receiver_id FROM connection_requests
       WHERE id = ? AND status = 'accepted'
         AND (sender_id = ? OR receiver_id = ?)`
    )
    .get(conversationId, userId, userId);
  if (!conversation) {
    return res.status(404).render('conversation-not-found');
  }

  // The other person is whichever of the two is not the logged-in user
  const otherId =
    conversation.sender_id === userId ? conversation.receiver_id : conversation.sender_id;
  const otherPerson = db.prepare('SELECT id, name FROM users WHERE id = ?').get(otherId);

  // The messages, oldest first, with each sender's name. id breaks a tie
  // between two messages sent in the same second.
  const messages = db
    .prepare(
      `SELECT messages.body, messages.created_at, users.name AS senderName
       FROM messages
       JOIN users ON users.id = messages.sender_id
       WHERE messages.request_id = ?
       ORDER BY messages.created_at, messages.id`
    )
    .all(conversationId)
    // Add the UK time to each message, ready for the page
    .map((message) => ({ ...message, time: formatTime(message.created_at) }));

  res.render('conversation', { conversationId, otherPerson, messages });
});

// Share the router with app.js
module.exports = router;
