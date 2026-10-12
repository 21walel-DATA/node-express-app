const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON payloads from incoming requests
app.use(express.json());

// Initialize SQLite database file.
// No tables are created here yet: they will come from schema.sql in a later step.
const db = new Database('app.db');

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

// 1. HOME: A simple page that proves the server is running.
// The old /api/users practice routes were removed because anyone could
// read, change and delete users without logging in.
app.get('/', (req, res) => {
  res.json({ message: 'Bootcamp Connect is running' });
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
