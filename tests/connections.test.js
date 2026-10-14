// tests/connections.test.js
// Tests for feature 04, connection requests (specs/04-messaging.md).
// The groups, in order: what the profile page shows, and sending a request.
// Run all tests with: npm test

// test: Node's built-in function for defining one test
const test = require('node:test');
// assert: Node's built-in checks. If a check fails, the test fails.
const assert = require('node:assert');
// request: supertest sends a pretend HTTP request straight to the app
const request = require('supertest');

// The app, set up to use a throwaway in-memory database
const app = require('./helpers');
const db = require('../db');
// loginAs gives us a pretend user who is already logged in.
// createUser adds a user without logging them in.
const { loginAs, createUser } = require('./loginHelper');

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

// Adds a request straight to the database, skipping the button.
// status is 'pending', 'accepted' or 'declined'. Gives back the new
// request's id number.
function addRequest(senderId, receiverId, status) {
  const result = db
    .prepare('INSERT INTO connection_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)')
    .run(senderId, receiverId, status);
  return result.lastInsertRowid;
}

// Reads a request's status straight from the database
function getStatus(requestId) {
  return db.prepare('SELECT status FROM connection_requests WHERE id = ?').get(requestId).status;
}

// Counts the requests between two people, either way round
function countRequests(userA, userB) {
  return db
    .prepare(
      `SELECT COUNT(*) AS total FROM connection_requests
       WHERE (sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?)`
    )
    .get(userA, userB, userB, userA).total;
}

// ---------------------------------------------------------
// 1. WHAT THE PROFILE PAGE SHOWS
// ---------------------------------------------------------

test('someone else\'s profile shows the "Send connection request" button', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });

  const response = await agent.get(`/profile/${other.id}`);

  assert.strictEqual(response.status, 200);
  // The button sits in a form that posts to the "send" address
  assert.match(response.text, new RegExp(`action="/connections/request/${other.id}"`));
  assert.match(response.text, /Send connection request/);
});

test('your own profile has no "Send connection request" button', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get(`/profile/${agent.user.id}`);

  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /Send connection request/);
});

test('a request you sent that is waiting shows "Request sent"', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });
  addRequest(agent.user.id, other.id, 'pending');

  const response = await agent.get(`/profile/${other.id}`);

  assert.match(response.text, /Request sent/);
  assert.doesNotMatch(response.text, /Send connection request/);
});

test('a request you sent that was declined still shows "Request sent"', async () => {
  // Decision 2: the sender is never told "no"
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });
  addRequest(agent.user.id, other.id, 'declined');

  const response = await agent.get(`/profile/${other.id}`);

  assert.match(response.text, /Request sent/);
  assert.doesNotMatch(response.text, /declined/i);
  assert.doesNotMatch(response.text, /Send connection request/);
});

test('a waiting request sent TO you shows "They have sent you a request"', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });
  addRequest(other.id, agent.user.id, 'pending');

  const response = await agent.get(`/profile/${other.id}`);

  assert.match(response.text, /They have sent you a request/);
  // A link to the page where it can be accepted (build step 2)
  assert.match(response.text, /href="\/connections"/);
  assert.doesNotMatch(response.text, /Send connection request/);
});

test('a request you declined shows "You declined their request"', async () => {
  // One request per pair: the person who declined gets no button either
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });
  addRequest(other.id, agent.user.id, 'declined');

  const response = await agent.get(`/profile/${other.id}`);

  assert.match(response.text, /You declined their request/);
  assert.doesNotMatch(response.text, /Send connection request/);
});

test('an accepted request shows "You are connected" to both people', async () => {
  const sender = await loginAs(app, { setupComplete: true });
  const receiver = await loginAs(app, { setupComplete: true });
  addRequest(sender.user.id, receiver.user.id, 'accepted');

  const senderView = await sender.get(`/profile/${receiver.user.id}`);
  const receiverView = await receiver.get(`/profile/${sender.user.id}`);

  assert.match(senderView.text, /You are connected/);
  assert.match(receiverView.text, /You are connected/);
  assert.doesNotMatch(senderView.text, /Send connection request/);
  assert.doesNotMatch(receiverView.text, /Send connection request/);
});

// ---------------------------------------------------------
// 2. SENDING A REQUEST
// ---------------------------------------------------------

test('sending a request saves one waiting request and goes back to the profile', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });

  const response = await agent.post(`/connections/request/${other.id}`);

  // 302 is a redirect: the browser is sent back to the profile page
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, `/profile/${other.id}`);

  const saved = db
    .prepare('SELECT status FROM connection_requests WHERE sender_id = ? AND receiver_id = ?')
    .get(agent.user.id, other.id);
  assert.strictEqual(saved.status, 'pending');

  // The profile now shows the new status
  const profile = await agent.get(`/profile/${other.id}`);
  assert.match(profile.text, /Request sent/);
});

test('a request to yourself is refused and nothing is saved', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.post(`/connections/request/${agent.user.id}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, `/profile/${agent.user.id}`);
  const total = db
    .prepare('SELECT COUNT(*) AS total FROM connection_requests WHERE sender_id = ?')
    .get(agent.user.id).total;
  assert.strictEqual(total, 0);
});

test('a second request to the same person is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });

  await agent.post(`/connections/request/${other.id}`);
  const response = await agent.post(`/connections/request/${other.id}`);

  // No crash (the database would refuse a duplicate with an error), and
  // still only one request
  assert.strictEqual(response.status, 302);
  assert.strictEqual(countRequests(agent.user.id, other.id), 1);
});

test('a request back to someone who already asked you is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });
  addRequest(other.id, agent.user.id, 'pending');

  const response = await agent.post(`/connections/request/${other.id}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(countRequests(agent.user.id, other.id), 1);
});

test('a request back to someone you declined is refused (one request per pair)', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });
  addRequest(other.id, agent.user.id, 'declined');

  const response = await agent.post(`/connections/request/${other.id}`);

  // Sent back to their profile, and still only their one request
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, `/profile/${other.id}`);
  assert.strictEqual(countRequests(agent.user.id, other.id), 1);
});

test('a request to someone who does not exist shows "Profile not found"', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.post('/connections/request/999999');

  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
});

test('a request to someone who has not finished setup shows "Profile not found"', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const unfinished = createUser({ setupComplete: false });

  const response = await agent.post(`/connections/request/${unfinished.id}`);

  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
  assert.strictEqual(countRequests(agent.user.id, unfinished.id), 0);
});

test('a request to an address that is not a number shows "Profile not found"', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.post('/connections/request/abc');

  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Profile not found/);
});

test('a logged-out visitor cannot send a request', async () => {
  const other = createUser({ setupComplete: true });

  const response = await request(app).post(`/connections/request/${other.id}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
  const total = db
    .prepare('SELECT COUNT(*) AS total FROM connection_requests WHERE receiver_id = ?')
    .get(other.id).total;
  assert.strictEqual(total, 0);
});

test('a user who has not finished setup is sent to the profile form instead', async () => {
  const agent = await loginAs(app, { setupComplete: false });
  const other = createUser({ setupComplete: true });

  const response = await agent.post(`/connections/request/${other.id}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/profile/edit');
  assert.strictEqual(countRequests(agent.user.id, other.id), 0);
});

// ---------------------------------------------------------
// 3. THE CONNECTIONS PAGE
// ---------------------------------------------------------

// Cuts one list out of the Connections page, so a test can check that a
// name is in the RIGHT list, not just somewhere on the page.
// Each list is a <section> with an id: received, sent or connected.
function getSection(html, id) {
  // [\s\S]*? means "any characters, as few as possible". Inside a `...`
  // string each backslash must be written twice.
  const found = html.match(new RegExp(`<section id="${id}"[^>]*>([\\s\\S]*?)</section>`));
  // An empty text when the section is missing, so "doesNotMatch" still works
  return found ? found[1] : '';
}

test('the Connections page with nothing on it shows "No connections yet"', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/connections');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /No connections yet/);
  // A way to find people: the dashboard
  assert.match(response.text, /href="\/"/);
});

test('a waiting request to you is under "Requests to you"', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const asker = createUser({ name: 'Rita Received', setupComplete: true });
  addRequest(asker.id, agent.user.id, 'pending');

  const response = await agent.get('/connections');

  const received = getSection(response.text, 'received');
  assert.match(received, /Rita Received/);
  // The name links to their profile
  assert.match(received, new RegExp(`href="/profile/${asker.id}"`));
  assert.doesNotMatch(response.text, /No connections yet/);
});

test('a request you declined is no longer listed anywhere', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const asker = createUser({ name: 'Dora Declined', setupComplete: true });
  addRequest(asker.id, agent.user.id, 'declined');

  const response = await agent.get('/connections');

  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /Dora Declined/);
  assert.match(response.text, /No connections yet/);
});

test('requests you sent are under "Requests you sent", even declined ones', async () => {
  // Decision 2: the sender is never told "no"
  const agent = await loginAs(app, { setupComplete: true });
  const waiting = createUser({ name: 'Wendy Waiting', setupComplete: true });
  const declined = createUser({ name: 'Nadia Nolan', setupComplete: true });
  addRequest(agent.user.id, waiting.id, 'pending');
  addRequest(agent.user.id, declined.id, 'declined');

  const response = await agent.get('/connections');

  const sent = getSection(response.text, 'sent');
  assert.match(sent, /Wendy Waiting/);
  assert.match(sent, /Nadia Nolan/);
  assert.doesNotMatch(response.text, /declined/i);
});

test('an accepted request is under "Your connections" for both people', async () => {
  const sender = await loginAs(app, { name: 'Sam Sender', setupComplete: true });
  const receiver = await loginAs(app, { name: 'Rob Receiver', setupComplete: true });
  addRequest(sender.user.id, receiver.user.id, 'accepted');

  const senderPage = await sender.get('/connections');
  const receiverPage = await receiver.get('/connections');

  assert.match(getSection(senderPage.text, 'connected'), /Rob Receiver/);
  assert.match(getSection(receiverPage.text, 'connected'), /Sam Sender/);
  // And not in the other lists
  assert.doesNotMatch(getSection(senderPage.text, 'sent'), /Rob Receiver/);
  assert.doesNotMatch(getSection(receiverPage.text, 'received'), /Sam Sender/);
});

test('the Connections page never shows other people\'s requests', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other1 = createUser({ name: 'Olive Outsider', setupComplete: true });
  const other2 = createUser({ name: 'Otto Outsider', setupComplete: true });
  const other3 = createUser({ name: 'Oscar Outsider', setupComplete: true });
  addRequest(other1.id, other2.id, 'pending');
  addRequest(other2.id, other3.id, 'accepted');

  const response = await agent.get('/connections');

  assert.strictEqual(response.status, 200);
  assert.doesNotMatch(response.text, /Outsider/);
  assert.match(response.text, /No connections yet/);
});

test('the Connections page never shows email addresses', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const asker = createUser({ email: 'secret-asker@example.com', setupComplete: true });
  addRequest(asker.id, agent.user.id, 'pending');

  const response = await agent.get('/connections');

  // The page loads and lists the person, but without their email
  assert.strictEqual(response.status, 200);
  assert.match(getSection(response.text, 'received'), new RegExp(`/profile/${asker.id}"`));
  assert.doesNotMatch(response.text, /secret-asker@example\.com/);
});

test('a logged-out visitor cannot see the Connections page', async () => {
  const response = await request(app).get('/connections');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// ---------------------------------------------------------
// 4. ACCEPT AND DECLINE
// ---------------------------------------------------------

test('a waiting request to you has Accept and Decline buttons', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const asker = createUser({ setupComplete: true });
  const requestId = addRequest(asker.id, agent.user.id, 'pending');

  const response = await agent.get('/connections');

  const received = getSection(response.text, 'received');
  assert.match(received, new RegExp(`action="/connections/${requestId}/accept"`));
  assert.match(received, new RegExp(`action="/connections/${requestId}/decline"`));
});

test('accepting a request connects the two people', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const asker = createUser({ name: 'Ann Accepted', setupComplete: true });
  const requestId = addRequest(asker.id, agent.user.id, 'pending');

  const response = await agent.post(`/connections/${requestId}/accept`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/connections');
  assert.strictEqual(getStatus(requestId), 'accepted');

  // They have moved from "Requests to you" to "Your connections"
  const page = await agent.get('/connections');
  assert.match(getSection(page.text, 'connected'), /Ann Accepted/);
  assert.doesNotMatch(getSection(page.text, 'received'), /Ann Accepted/);
});

test('declining a request marks it declined, and the sender still sees "Request sent"', async () => {
  const asker = await loginAs(app, { setupComplete: true });
  const agent = await loginAs(app, { setupComplete: true });
  const requestId = addRequest(asker.user.id, agent.user.id, 'pending');

  const response = await agent.post(`/connections/${requestId}/decline`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/connections');
  assert.strictEqual(getStatus(requestId), 'declined');

  // Decision 2: the sender is never told "no"
  const senderView = await asker.get(`/profile/${agent.user.id}`);
  assert.match(senderView.text, /Request sent/);
});

test('the sender cannot accept their own request', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = createUser({ setupComplete: true });
  const requestId = addRequest(agent.user.id, other.id, 'pending');

  const response = await agent.post(`/connections/${requestId}/accept`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/connections');
  assert.strictEqual(getStatus(requestId), 'pending');
});

test('a third person cannot accept or decline someone else\'s request', async () => {
  const outsider = await loginAs(app, { setupComplete: true });
  const sender = createUser({ setupComplete: true });
  const receiver = createUser({ setupComplete: true });
  const requestId = addRequest(sender.id, receiver.id, 'pending');

  const acceptTry = await outsider.post(`/connections/${requestId}/accept`);
  const declineTry = await outsider.post(`/connections/${requestId}/decline`);

  // Sent back to their own Connections page, and nothing changed
  assert.strictEqual(acceptTry.headers.location, '/connections');
  assert.strictEqual(declineTry.headers.location, '/connections');
  assert.strictEqual(getStatus(requestId), 'pending');
});

test('a request that was already answered cannot be changed', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const asker1 = createUser({ setupComplete: true });
  const asker2 = createUser({ setupComplete: true });
  const declinedId = addRequest(asker1.id, agent.user.id, 'declined');
  const acceptedId = addRequest(asker2.id, agent.user.id, 'accepted');

  const acceptTry = await agent.post(`/connections/${declinedId}/accept`);
  const declineTry = await agent.post(`/connections/${acceptedId}/decline`);

  assert.strictEqual(acceptTry.headers.location, '/connections');
  assert.strictEqual(declineTry.headers.location, '/connections');
  assert.strictEqual(getStatus(declinedId), 'declined');
  assert.strictEqual(getStatus(acceptedId), 'accepted');
});

test('accepting a request that does not exist, or "abc", changes nothing', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const missing = await agent.post('/connections/999999/accept');
  const notANumber = await agent.post('/connections/abc/accept');

  assert.strictEqual(missing.status, 302);
  assert.strictEqual(missing.headers.location, '/connections');
  assert.strictEqual(notANumber.status, 302);
  assert.strictEqual(notANumber.headers.location, '/connections');
});

test('a logged-out visitor cannot accept a request', async () => {
  const sender = createUser({ setupComplete: true });
  const receiver = createUser({ setupComplete: true });
  const requestId = addRequest(sender.id, receiver.id, 'pending');

  const response = await request(app).post(`/connections/${requestId}/accept`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
  assert.strictEqual(getStatus(requestId), 'pending');
});

// ---------------------------------------------------------
// 5. THE HEADER LINK (added with Walied's agreement, final live check #20)
// ---------------------------------------------------------

test('the header has a Connections link for a logged-in user', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/');

  // Only look inside the header's <nav>, so a link elsewhere on the page
  // does not count
  const nav = response.text.split('<nav')[1].split('</nav>')[0];
  assert.match(nav, /<a href="\/connections">Connections<\/a>/);
});

test('the header has no Connections link for a logged-out visitor', async () => {
  const response = await request(app).get('/login');

  const nav = response.text.split('<nav')[1].split('</nav>')[0];
  assert.doesNotMatch(nav, /\/connections/);
});
