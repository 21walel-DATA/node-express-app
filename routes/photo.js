// routes/photo.js
// Routes for uploading a profile photo (feature 07).
// app.js plugs this router in behind the login check, so every route here
// is for logged-in users, and always acts on THEIR OWN photo: the user id
// comes from the session, never from the form or the address.

const path = require('path');
const express = require('express');
// multer reads files sent from a form (see "upload" below)
const multer = require('multer');
const db = require('../db');
const { PHOTO_DIR, MAX_PHOTO_BYTES, isJpeg, savePhoto } = require('../photos');

const router = express.Router();

// ---------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------

// A form that sends a file uses a different format ("multipart/form-data")
// from a normal form, and express.urlencoded in app.js cannot read it.
// multer can. memoryStorage keeps the uploaded file in memory as a Buffer
// (raw bytes), so we can check it BEFORE anything is saved to disk.
// limits stops reading as soon as a file is too big, or there is more than
// one file, so nobody can fill the server's memory with a huge upload.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
}).single('photo');
// .single('photo') means: expect one file, from the form field named "photo"

// Shows the upload page, with any problems to explain
function renderPhotoPage(res, errors = [], status = 200) {
  res.status(status).render('photo', { errors });
}

// ---------------------------------------------------------
// PHOTO ROUTES
// ---------------------------------------------------------

// 1. UPLOAD PAGE: GET /photo shows the form for choosing a photo
router.get('/photo', (req, res) => {
  renderPhotoPage(res);
});

// 2. UPLOAD: POST /photo receives the chosen file
router.post('/photo', (req, res) => {
  // We call multer ourselves (instead of listing it before the route) so we
  // can catch its errors, such as a file that is too big, and show a clear
  // message instead of an error page
  upload(req, res, (error) => {
    // 2a. Problems multer found while reading the upload
    if (error) {
      // LIMIT_FILE_SIZE is multer's code for "the file is bigger than the limit"
      if (error.code === 'LIMIT_FILE_SIZE') {
        return renderPhotoPage(res, ['The photo must be 2 MB or smaller.'], 400);
      }
      return renderPhotoPage(res, ['The photo could not be uploaded. Please try again.'], 400);
    }

    // 2b. multer puts the file on req.file; it is missing if none was chosen
    if (!req.file) {
      return renderPhotoPage(res, ['Choose a photo to upload.'], 400);
    }

    // 2c. Check the file really is a JPEG, by its first bytes (see photos.js)
    if (!isJpeg(req.file.buffer)) {
      return renderPhotoPage(res, ['The photo must be a JPEG image (.jpg or .jpeg).'], 400);
    }

    // 2d. Save the file, then remember its name on the user's row
    const userId = res.locals.currentUser.id;
    const filename = savePhoto(userId, req.file.buffer);
    db.prepare('UPDATE users SET photo_filename = ? WHERE id = ?').run(filename, userId);

    // Back to the user's own profile (Post/Redirect/Get)
    res.redirect(`/profile/${userId}`);
  });
});

// 3. SHOW A PHOTO: GET /photos/7-3f9c2a1b8d4e6f00.jpg sends that image.
// The photos are NOT in public/, because public/ is open to everyone and
// profiles are for logged-in users only. This route sits behind the login
// check, like the profile pages.
router.get('/photos/:filename', (req, res) => {
  const filename = req.params.filename;

  // 3a. Only send a file whose name is saved on a user's row. Names come
  // from savePhoto, so a made-up name (or a trick like '../app.js') matches
  // nobody and is refused. sendStatus(404) answers "Not Found" with no page,
  // which suits an image.
  const owner = db
    .prepare('SELECT id, setup_complete FROM users WHERE photo_filename = ?')
    .get(filename);
  if (!owner) {
    return res.sendStatus(404);
  }

  // 3b. Match the profile page: a person who has not finished setup has no
  // profile to show, so their photo is hidden from everyone but themselves
  if (owner.setup_complete === 0 && owner.id !== res.locals.currentUser.id) {
    return res.sendStatus(404);
  }

  // 3c. Send the file. sendFile needs a full path, so path.resolve turns
  // a relative folder like 'photos' into one. It also sets the Content-Type
  // to image/jpeg from the .jpg ending. If the file is missing from disk,
  // the callback gets an error, and we answer "Not Found".
  res.sendFile(path.resolve(PHOTO_DIR, filename), (error) => {
    if (error && !res.headersSent) {
      res.sendStatus(404);
    }
  });
});

// Share the router with app.js
module.exports = router;
