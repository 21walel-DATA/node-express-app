// db.js
// Opens the SQLite database once and shares that one connection with the
// rest of the app. Any file that needs the database writes:
//   const db = require('./db');

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Where the database file lives.
// On Railway we will set the DB_PATH environment variable to a location
// inside the volume, so the data survives redeploys.
// On a laptop DB_PATH is not set, so we fall back to app.db in this folder.
const DB_PATH = process.env.DB_PATH || 'app.db';

// Open (or create) the database file.
const db = new Database(DB_PATH);

// SQLite ignores foreign keys unless this is switched on for each connection.
// Without it, rules such as ON DELETE CASCADE in schema.sql would do nothing.
db.pragma('foreign_keys = ON');

// Create any missing tables by running schema.sql.
// db.exec runs a whole file of SQL at once. That is safe here because the
// file is ours and contains no user input. Anything that includes user
// input must still use a prepared statement with ? placeholders.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Share the connection with other files
module.exports = db;
