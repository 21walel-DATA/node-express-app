// tests/messages.test.js
// Tests for feature 04, conversations and messages (specs/04-messaging.md).
// The groups, in order: reading a conversation, who may open it, the
// "Open conversation" links, and sending a message.
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

// Adds a request straight to the database and gives back its id number.
// status is 'pending', 'accepted' or 'declined'.
function addRequest(senderId, receiverId, status) {
  const result = db
    .prepare('INSERT INTO connection_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)')
    .run(senderId, receiverId, status);
  return result.lastInsertRowid;
}

// Adds a message straight to the database. createdAt is optional, in the
// database's own format and in UTC, for example '2026-10-14 20:51:09'.
function addMessage(requestId, senderId, body, createdAt) {
  if (createdAt) {
    db.prepare(
      'INSERT INTO messages (request_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)'
    ).run(requestId, senderId, body, createdAt);
  } else {
    db.prepare('INSERT INTO messages (request_id, sender_id, body) VALUES (?, ?, ?)').run(
      requestId,
      senderId,
      body
    );
  }
}

// Two logged-in people with an accepted request between them
async function makeConnectedPair() {
  const sender = await loginAs(app, { name: 'Sara Sender', setupComplete: true });
  const receiver = await loginAs(app, { name: 'Rafi Receiver', setupComplete: true });
  const requestId = addRequest(sender.user.id, receiver.user.id, 'accepted');
  return { sender, receiver, requestId };
}

// ---------------------------------------------------------
// 1. READING A CONVERSATION
// ---------------------------------------------------------

test('both people in a conversation can open it', async () => {
  const { sender, receiver, requestId } = await makeConnectedPair();

  const senderView = await sender.get(`/conversations/${requestId}`);
  const receiverView = await receiver.get(`/conversations/${requestId}`);

  assert.strictEqual(senderView.status, 200);
  assert.strictEqual(receiverView.status, 200);
  // Each sees the OTHER person's name in the heading
  assert.match(senderView.text, /Conversation with Rafi Receiver/);
  assert.match(receiverView.text, /Conversation with Sara Sender/);
});

test('messages are shown oldest first', async () => {
  const { sender, receiver, requestId } = await makeConnectedPair();
  // Added newest first on purpose, so the order must come from the times
  addMessage(requestId, receiver.user.id, 'Second message', '2026-10-14 10:05:00');
  addMessage(requestId, sender.user.id, 'First message', '2026-10-14 10:00:00');

  const response = await sender.get(`/conversations/${requestId}`);

  const first = response.text.indexOf('First message');
  const second = response.text.indexOf('Second message');
  assert.ok(first !== -1 && second !== -1, 'both messages are on the page');
  assert.ok(first < second, 'the older message comes first');
});

test('each message shows who sent it and the time in UK time', async () => {
  const { sender, requestId } = await makeConnectedPair();
  // 20:51 UTC in October is 21:51 in the UK (British Summer Time)
  addMessage(requestId, sender.user.id, 'Hello in summer time', '2026-10-14 20:51:09');
  // In December UK time and UTC are the same
  addMessage(requestId, sender.user.id, 'Hello in winter time', '2026-12-01 09:05:00');

  const response = await sender.get(`/conversations/${requestId}`);

  assert.match(response.text, /Sara Sender/);
  assert.match(response.text, /14 Oct 2026, 21:51/);
  assert.match(response.text, /1 Dec 2026, 09:05/);
});

test('a conversation with no messages says "No messages yet"', async () => {
  const { sender, requestId } = await makeConnectedPair();

  const response = await sender.get(`/conversations/${requestId}`);

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /No messages yet/);
});

test('a message is shown as plain text, never run as code', async () => {
  const { sender, requestId } = await makeConnectedPair();
  addMessage(requestId, sender.user.id, '<script>alert("hi")</script>');

  const response = await sender.get(`/conversations/${requestId}`);

  // EJS turns < into &lt;, so the browser shows it instead of running it
  assert.doesNotMatch(response.text, /<script>alert/);
  assert.match(response.text, /&lt;script&gt;/);
});

// ---------------------------------------------------------
// 2. WHO MAY OPEN A CONVERSATION
// ---------------------------------------------------------

// Checks a response is the "misdirected" page (decision 4)
function assertMisdirected(response) {
  assert.strictEqual(response.status, 404);
  assert.match(response.text, /Oops, you have been misdirected/);
  assert.match(response.text, /href="\/connections"/);
}

test('a third person cannot read a conversation, even by typing its address', async () => {
  const { sender, requestId } = await makeConnectedPair();
  addMessage(requestId, sender.user.id, 'A private hello');
  const outsider = await loginAs(app, { setupComplete: true });

  const response = await outsider.get(`/conversations/${requestId}`);

  assertMisdirected(response);
  assert.doesNotMatch(response.text, /A private hello/);
});

test('a request that is still waiting has no conversation yet', async () => {
  const sender = await loginAs(app, { setupComplete: true });
  const receiver = createUser({ setupComplete: true });
  const requestId = addRequest(sender.user.id, receiver.id, 'pending');

  const response = await sender.get(`/conversations/${requestId}`);

  assertMisdirected(response);
});

test('a declined request has no conversation', async () => {
  const sender = createUser({ setupComplete: true });
  const receiver = await loginAs(app, { setupComplete: true });
  const requestId = addRequest(sender.id, receiver.user.id, 'declined');

  const response = await receiver.get(`/conversations/${requestId}`);

  assertMisdirected(response);
});

test('a conversation that does not exist, or "abc", shows the misdirected page', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  assertMisdirected(await agent.get('/conversations/999999'));
  assertMisdirected(await agent.get('/conversations/abc'));
});

test('a logged-out visitor cannot read a conversation', async () => {
  const sender = createUser({ setupComplete: true });
  const receiver = createUser({ setupComplete: true });
  const requestId = addRequest(sender.id, receiver.id, 'accepted');

  const response = await request(app).get(`/conversations/${requestId}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// ---------------------------------------------------------
// 3. THE "OPEN CONVERSATION" LINKS
// ---------------------------------------------------------

test('a connected profile links to the conversation', async () => {
  const { sender, receiver, requestId } = await makeConnectedPair();

  const response = await sender.get(`/profile/${receiver.user.id}`);

  assert.match(response.text, /You are connected/);
  assert.match(response.text, new RegExp(`href="/conversations/${requestId}"`));
});

test('each connection on the Connections page links to the conversation', async () => {
  const { receiver, requestId } = await makeConnectedPair();

  const response = await receiver.get('/connections');

  assert.match(response.text, new RegExp(`href="/conversations/${requestId}"`));
});

// ---------------------------------------------------------
// 4. SENDING A MESSAGE
// ---------------------------------------------------------

// Counts the messages in one conversation
function countMessages(requestId) {
  return db.prepare('SELECT COUNT(*) AS total FROM messages WHERE request_id = ?').get(requestId)
    .total;
}

test('the conversation page has a labelled box for writing a message', async () => {
  const { sender, requestId } = await makeConnectedPair();

  const response = await sender.get(`/conversations/${requestId}`);

  assert.match(response.text, new RegExp(`<form method="post" action="/conversations/${requestId}"`));
  assert.match(response.text, /<label for="message">Your message<\/label>/);
  // The browser stops at 500 characters too (the server checks again)
  assert.match(response.text, /<textarea[^>]*id="message"[^>]*maxlength="500"/);
});

test('sending a message saves it and the other person can read it', async () => {
  const { sender, receiver, requestId } = await makeConnectedPair();

  const response = await sender
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: 'Hello, shall we meet?' });

  // Post/Redirect/Get: back to the conversation
  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, `/conversations/${requestId}`);

  const saved = db.prepare('SELECT sender_id, body FROM messages WHERE request_id = ?').get(requestId);
  assert.strictEqual(saved.sender_id, sender.user.id);
  assert.strictEqual(saved.body, 'Hello, shall we meet?');

  const receiverView = await receiver.get(`/conversations/${requestId}`);
  assert.match(receiverView.text, /Hello, shall we meet\?/);
});

test('the sender is always the logged-in user, whatever the form says', async () => {
  const { sender, receiver, requestId } = await makeConnectedPair();

  // A sneaky extra field trying to post as the other person
  await sender
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: 'Who sent this?', sender_id: receiver.user.id });

  const saved = db.prepare('SELECT sender_id FROM messages WHERE request_id = ?').get(requestId);
  assert.strictEqual(saved.sender_id, sender.user.id);
});

test('an empty message, or only spaces, is refused and nothing is saved', async () => {
  const { sender, requestId } = await makeConnectedPair();

  const empty = await sender.post(`/conversations/${requestId}`).type('form').send({ message: '' });
  const spaces = await sender
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: '   ' });

  // 400 is the HTTP status code for "Bad Request"
  assert.strictEqual(empty.status, 400);
  assert.match(empty.text, /Please write a message before sending\./);
  assert.strictEqual(spaces.status, 400);
  assert.strictEqual(countMessages(requestId), 0);
});

test('a message over 500 characters is refused, and the text stays in the box', async () => {
  const { sender, requestId } = await makeConnectedPair();
  const tooLong = 'b'.repeat(501);

  const response = await sender
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: tooLong });

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /Your message must be 500 characters or fewer\./);
  assert.match(response.text, new RegExp(`>${tooLong}</textarea>`));
  assert.strictEqual(countMessages(requestId), 0);
});

test('a message of exactly 500 characters is accepted', async () => {
  const { sender, requestId } = await makeConnectedPair();

  const response = await sender
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: 'c'.repeat(500) });

  assert.strictEqual(response.status, 302);
  assert.strictEqual(countMessages(requestId), 1);
});

test('a third person cannot post in a conversation', async () => {
  const { requestId } = await makeConnectedPair();
  const outsider = await loginAs(app, { setupComplete: true });

  const response = await outsider
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: 'Let me in' });

  assertMisdirected(response);
  assert.strictEqual(countMessages(requestId), 0);
});

test('you cannot message someone whose request is still waiting', async () => {
  const sender = await loginAs(app, { setupComplete: true });
  const receiver = createUser({ setupComplete: true });
  const requestId = addRequest(sender.user.id, receiver.id, 'pending');

  const response = await sender
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: 'Hello?' });

  assertMisdirected(response);
  assert.strictEqual(countMessages(requestId), 0);
});

test('posting to a conversation that does not exist, or "abc", shows the misdirected page', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  assertMisdirected(
    await agent.post('/conversations/999999').type('form').send({ message: 'Hi' })
  );
  assertMisdirected(await agent.post('/conversations/abc').type('form').send({ message: 'Hi' }));
});

test('a logged-out visitor cannot post a message', async () => {
  const sender = createUser({ setupComplete: true });
  const receiver = createUser({ setupComplete: true });
  const requestId = addRequest(sender.id, receiver.id, 'accepted');

  const response = await request(app)
    .post(`/conversations/${requestId}`)
    .type('form')
    .send({ message: 'Hi' });

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
  assert.strictEqual(countMessages(requestId), 0);
});
