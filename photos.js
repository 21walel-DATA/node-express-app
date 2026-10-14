// photos.js
// Where profile photos are saved, and the checks a photo must pass
// (feature 07, simplified: JPEG only, no resizing).
// Any file that needs it writes:
//   const { PHOTO_DIR, isJpeg, savePhoto } = require('./photos');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------
// 1. WHERE PHOTOS ARE SAVED
// ---------------------------------------------------------

// Photos must live in the same place as the database, so on Railway they
// are inside the volume and survive redeploys.
// PHOTO_DIR can be set to choose a folder (the tests use a throwaway one).
// Otherwise it is a "photos" folder next to the database file:
//   DB_PATH=/data/app.db (Railway)  ->  /data/photos
//   DB_PATH not set (a laptop)      ->  ./photos in the project folder
// path.dirname gives the folder part of a path: '/data/app.db' -> '/data'.
const PHOTO_DIR =
  process.env.PHOTO_DIR || path.join(path.dirname(process.env.DB_PATH || 'app.db'), 'photos');

// Make the folder if it is missing. recursive: true also makes any missing
// parent folders, and does nothing if the folder is already there.
fs.mkdirSync(PHOTO_DIR, { recursive: true });

// ---------------------------------------------------------
// 2. THE RULES A PHOTO MUST PASS
// ---------------------------------------------------------

// The biggest photo allowed: 2 MB, written in bytes (1 MB = 1024 * 1024)
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Checks that the file really is a JPEG.
// We do NOT trust the file's name ('cat.jpg') or the type the browser
// reports, because anyone can rename a file. Instead we look at the first
// bytes of the file itself: every JPEG starts with the bytes FF D8 FF.
// (0x means "this number is written in hexadecimal".)
// file is a Buffer: Node's way of holding raw bytes.
function isJpeg(file) {
  return file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
}

// ---------------------------------------------------------
// 3. SAVING A PHOTO
// ---------------------------------------------------------

// Saves the photo's bytes to PHOTO_DIR and returns the new file's name.
// The name is made by us, never taken from the uploaded file, so nobody can
// choose a name like '../../app.js' to write somewhere else. It is the user
// id plus random letters, e.g. '7-3f9c2a1b8d4e6f00.jpg'; the random part
// means a new photo never has the same address as the old one, so browsers
// do not keep showing the old one from their cache.
function savePhoto(userId, file) {
  const filename = `${userId}-${crypto.randomBytes(8).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(PHOTO_DIR, filename), file);
  return filename;
}

// Share the settings and functions
module.exports = { PHOTO_DIR, MAX_PHOTO_BYTES, isJpeg, savePhoto };
