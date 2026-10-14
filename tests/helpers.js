// tests/helpers.js
// Shared setup for every test file. A test file starts with:
//   const app = require('./helpers');

// Tell db.js to use a throwaway database that lives only in memory.
// ':memory:' is a special SQLite name: the database is never written to
// disk and disappears when the test finishes, so tests never touch the
// real app.db.
// This line must run BEFORE app.js is loaded, because db.js reads DB_PATH
// at the moment it is first required.
process.env.DB_PATH = ':memory:';

// Save uploaded test photos in a new, empty folder inside the computer's
// temporary folder, so tests never touch real photos.
// fs.mkdtempSync makes a folder with a random ending, e.g.
// ...\Temp\bootcamp-photos-a1B2c3. Like DB_PATH, this must run before
// app.js is loaded, because photos.js reads PHOTO_DIR when first required.
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.PHOTO_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bootcamp-photos-'));

// Build the app (without starting a server) and share it with the tests
module.exports = require('../app');
