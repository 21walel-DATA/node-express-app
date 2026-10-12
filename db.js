// db.js
// Opens the SQLite database once and shares that one connection with the
// rest of the app. Any file that needs the database writes:
//   const db = require('./db');

const Database = require('better-sqlite3');

// Where the database file lives.
// On Railway we will set the DB_PATH environment variable to a location
// inside the volume, so the data survives redeploys.
// On a laptop DB_PATH is not set, so we fall back to app.db in this folder.
const DB_PATH = process.env.DB_PATH || 'app.db';

// Open (or create) the database file.
// No tables are created here yet: they will come from schema.sql in a later step.
const db = new Database(DB_PATH);

// Share the connection with other files
module.exports = db;
