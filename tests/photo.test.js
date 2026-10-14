// tests/photo.test.js
// Tests for uploading a profile photo (routes/photo.js and photos.js).
// Run all tests with: npm test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

// The app, set up to use a throwaway database AND a throwaway photo folder
const app = require('./helpers');
const db = require('../db');
const { loginAs } = require('./loginHelper');
const { PHOTO_DIR, MAX_PHOTO_BYTES } = require('../photos');

// ---------------------------------------------------------
// PRETEND FILES
// ---------------------------------------------------------

// A pretend JPEG: it starts with the bytes FF D8 FF like every JPEG, then
// some filler. That is enough for the server's check, which only looks at
// the first bytes. (Buffer.concat joins two lumps of bytes into one.)
const FAKE_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);

// A PNG image's first bytes: a real image, but not the allowed type
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Sends the upload form the way a browser does.
// .attach adds a file to the form, like choosing one in the file picker.
function upload(agent, bytes, filename) {
  return agent.post('/photo').attach('photo', bytes, { filename, contentType: 'image/jpeg' });
}

// Reads the user's saved photo file name from the database
function photoFilename(userId) {
  return db.prepare('SELECT photo_filename FROM users WHERE id = ?').get(userId).photo_filename;
}

// ---------------------------------------------------------
// UPLOADING
// ---------------------------------------------------------

// 1. NORMAL CASE: the upload page shows the form
test('GET /photo shows the upload form', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await agent.get('/photo');

  assert.strictEqual(response.status, 200);
  assert.match(response.text, /enctype="multipart\/form-data"/);
  assert.match(response.text, /type="file"/);
});

// 2. NORMAL CASE: a JPEG is saved, and the user's row remembers its name
test('uploading a JPEG saves it and goes back to the profile', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const response = await upload(agent, FAKE_JPEG, 'me.jpg');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, `/profile/${agent.user.id}`);

  const filename = photoFilename(agent.user.id);
  // The name is made by the server: "<user id>-<random letters>.jpg"
  assert.match(filename, new RegExp(`^${agent.user.id}-[0-9a-f]{16}\\.jpg$`));
  // The file is really in the photo folder, with the same bytes
  const saved = fs.readFileSync(path.join(PHOTO_DIR, filename));
  assert.deepStrictEqual(saved, FAKE_JPEG);
});

// 3. SECURITY: the uploaded file's own name is never used
test('the server ignores the uploaded file name', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  // A sneaky name that tries to write outside the photo folder
  await upload(agent, FAKE_JPEG, '../../app.js');

  assert.doesNotMatch(photoFilename(agent.user.id), /app\.js|\.\./);
});

// ---------------------------------------------------------
// REFUSED UPLOADS
// ---------------------------------------------------------

// 4. INVALID INPUT: a file of the wrong type is refused, even if it is
// renamed to .jpg
test('a file that is not a JPEG is refused, even named .jpg', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  const png = await upload(agent, FAKE_PNG, 'not-really.jpg');
  const text = await upload(agent, Buffer.from('hello, I am a text file'), 'notes.jpg');

  for (const response of [png, text]) {
    assert.strictEqual(response.status, 400);
    assert.match(response.text, /must be a JPEG image/);
  }
  assert.strictEqual(photoFilename(agent.user.id), null);
});

// 5. INVALID INPUT: a file over 2 MB is refused with a clear message
test('a photo over 2 MB is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  // A JPEG start, padded to one byte over the limit
  const tooBig = Buffer.concat([FAKE_JPEG, Buffer.alloc(MAX_PHOTO_BYTES)]);

  const response = await upload(agent, tooBig, 'huge.jpg');

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /2 MB or smaller/);
  assert.strictEqual(photoFilename(agent.user.id), null);
});

// 6. INVALID INPUT: sending the form with no file is refused
test('sending the form without a file is refused', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  // .field sends a normal text field, so the form arrives with no file
  const response = await agent.post('/photo').field('nothing', 'here');

  assert.strictEqual(response.status, 400);
  assert.match(response.text, /Choose a photo to upload/);
});

// ---------------------------------------------------------
// WHO CAN UPLOAD
// ---------------------------------------------------------

// 7. DENIED ACCESS: a logged-out visitor cannot upload
test('a logged-out visitor cannot upload a photo', async () => {
  const response = await upload(request(app), FAKE_JPEG, 'me.jpg');

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// 8. DENIED ACTION (finish line): a user cannot change anyone else's photo.
// The route only ever uses the logged-in user's id, so even sending
// another user's id in the form changes nothing for them.
test('a user cannot change anyone else\'s photo', async () => {
  const other = await loginAs(app, { setupComplete: true });
  const agent = await loginAs(app, { setupComplete: true });

  await agent
    .post('/photo')
    .field('user_id', String(other.user.id))
    .attach('photo', FAKE_JPEG, { filename: 'me.jpg', contentType: 'image/jpeg' });

  assert.strictEqual(photoFilename(other.user.id), null);
  assert.ok(photoFilename(agent.user.id));
});
