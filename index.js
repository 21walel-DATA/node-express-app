const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON payloads from incoming requests
app.use(express.json());

// Initialize SQLite database file
const db = new Database('app.db');

// Create users table if it doesn't exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  )
`).run();

// Root test route
app.get('/', (req, res) => {
  res.json({ message: 'Express & SQLite server is up and running!' });
});

// ---------------------------------------------------------
// CRUD API ENDPOINTS FOR USERS TABLE
// ---------------------------------------------------------

// 1. CREATE: Add a new user
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  try {
    const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    const result = insert.run(name, email);
    res.status(201).json({ id: result.lastInsertRowid, name, email });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists or invalid data.' });
  }
});

// 2. READ ALL: Fetch all users
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

// 3. READ ONE: Fetch a single user by ID
app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json(user);
});

// 4. UPDATE: Update a user's details by ID
app.put('/api/users/:id', (req, res) => {
  const { name, email } = req.body;
  const { id } = req.params;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const update = db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?');
  const result = update.run(name, email, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({ id: Number(id), name, email });
});

// 5. DELETE: Remove a user by ID
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
  const result = deleteStmt.run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json({ message: `User with ID ${id} deleted successfully.` });
});

// Start listening
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
