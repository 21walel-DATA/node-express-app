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

// Build the app (without starting a server) and share it with the tests
module.exports = require('../app');
