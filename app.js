// app.js
// Builds the Express app (middleware and routes) but does NOT start it.
// index.js starts the server. Tests will load this file directly, so they
// can send requests to the app without opening a real port.

const express = require('express');

// Loading db.js opens the database connection when the app is built.
// Nothing here uses it yet; the feature routes will.
require('./db');

const homeRoutes = require('./routes/home');

const app = express();

// Middleware to parse JSON payloads from incoming requests
app.use(express.json());

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

// Each feature gets its own file in routes/ and is plugged in here.
app.use('/', homeRoutes);

// Share the app with index.js and the tests
module.exports = app;
