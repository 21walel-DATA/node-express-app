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
const { deleteUser } = require('../accounts');

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

// ---------------------------------------------------------
// SHOWING PHOTOS
// ---------------------------------------------------------

// 9. NORMAL CASE (finish line): an uploaded photo shows on the profile,
// in place of the initials circle
test('an uploaded photo shows on the profile instead of the initials', async () => {
  const agent = await loginAs(app, { name: 'Pia Photo', setupComplete: true });
  await upload(agent, FAKE_JPEG, 'me.jpg');
  const filename = photoFilename(agent.user.id);

  // Another student looks at the profile
  const viewer = await loginAs(app, { setupComplete: true });
  const response = await viewer.get(`/profile/${agent.user.id}`);

  assert.strictEqual(response.status, 200);
  assert.match(response.text, new RegExp(`<img class="profile-photo" src="/photos/${filename}"`));
  assert.doesNotMatch(response.text, /class="initials/);
});

// 10. NORMAL CASE: with no photo, the initials circle is shown
test('a profile without a photo shows the initials circle', async () => {
  const agent = await loginAs(app, { name: 'Nina Nophoto', setupComplete: true });

  const response = await agent.get(`/profile/${agent.user.id}`);

  assert.match(response.text, /class="initials/);
  assert.doesNotMatch(response.text, /class="profile-photo"/);
});

// 11. NORMAL CASE: a logged-in user can load another user's photo file
test('a logged-in user can load a photo file', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  await upload(agent, FAKE_JPEG, 'me.jpg');
  const viewer = await loginAs(app, { setupComplete: true });

  const response = await viewer.get(`/photos/${photoFilename(agent.user.id)}`);

  assert.strictEqual(response.status, 200);
  assert.match(response.headers['content-type'], /image\/jpeg/);
  assert.deepStrictEqual(response.body, FAKE_JPEG);
});

// 12. NORMAL CASE: your own profile links to the upload page, with the
// right words; someone else's profile does not
test('only your own profile has the Add or Change photo link', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  const other = await loginAs(app, { setupComplete: true });

  const before = await agent.get(`/profile/${agent.user.id}`);
  await upload(agent, FAKE_JPEG, 'me.jpg');
  const after = await agent.get(`/profile/${agent.user.id}`);
  const othersPage = await other.get(`/profile/${agent.user.id}`);

  assert.match(before.text, /<a href="\/photo">Add a photo<\/a>/);
  assert.match(after.text, /<a href="\/photo">Change photo<\/a>/);
  assert.doesNotMatch(othersPage.text, /href="\/photo"/);
});

// 13. DENIED ACCESS: photos are for logged-in users only
test('a logged-out visitor cannot load a photo file', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  await upload(agent, FAKE_JPEG, 'me.jpg');

  const response = await request(app).get(`/photos/${photoFilename(agent.user.id)}`);

  assert.strictEqual(response.status, 302);
  assert.strictEqual(response.headers.location, '/login');
});

// 14. SECURITY: only file names saved on a user's row are ever sent
test('made-up photo names and path tricks get 404', async () => {
  const agent = await loginAs(app, { setupComplete: true });

  // %2F is how a "/" is written inside an address, so this asks for
  // "../app.js": an attempt to read a file outside the photo folder
  for (const address of ['/photos/1-0000000000000000.jpg', '/photos/..%2Fapp.js', '/photos/app.db']) {
    const response = await agent.get(address);
    assert.strictEqual(response.status, 404, `${address} should be 404`);
  }
});

// ---------------------------------------------------------
// DELETING PHOTO FILES
// ---------------------------------------------------------

// Says whether a photo file is in the photo folder
function fileExists(filename) {
  return fs.existsSync(path.join(PHOTO_DIR, filename));
}

// 15. NORMAL CASE: a new photo replaces the old one, and the old file is
// deleted, so old photos do not pile up in the volume
test('uploading a new photo deletes the old file', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  await upload(agent, FAKE_JPEG, 'first.jpg');
  const oldFilename = photoFilename(agent.user.id);
  assert.ok(fileExists(oldFilename));

  await upload(agent, FAKE_JPEG, 'second.jpg');
  const newFilename = photoFilename(agent.user.id);

  assert.notStrictEqual(newFilename, oldFilename);
  assert.ok(fileExists(newFilename));
  assert.strictEqual(fileExists(oldFilename), false);
});

// 16. NORMAL CASE: a refused upload keeps the photo the user already had
test('a refused upload keeps the existing photo', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  await upload(agent, FAKE_JPEG, 'good.jpg');
  const filename = photoFilename(agent.user.id);

  await upload(agent, FAKE_PNG, 'bad.jpg');

  assert.strictEqual(photoFilename(agent.user.id), filename);
  assert.ok(fileExists(filename));
});

// 17. NORMAL CASE (finish line): deleting the account removes the photo file
test('deleting an account deletes its photo file', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  await upload(agent, FAKE_JPEG, 'me.jpg');
  const filename = photoFilename(agent.user.id);

  assert.strictEqual(deleteUser(agent.user.id), true);

  assert.strictEqual(fileExists(filename), false);
});

// 18. EDGE CASE: a photo file already missing from disk does not stop the
// account being deleted
test('deleting an account still works if its photo file is already gone', async () => {
  const agent = await loginAs(app, { setupComplete: true });
  await upload(agent, FAKE_JPEG, 'me.jpg');
  fs.rmSync(path.join(PHOTO_DIR, photoFilename(agent.user.id)));

  assert.strictEqual(deleteUser(agent.user.id), true);
  assert.strictEqual(db.prepare('SELECT id FROM users WHERE id = ?').get(agent.user.id), undefined);
});
