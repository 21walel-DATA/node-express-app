// app.js
// Builds the Express app (middleware and routes) but does NOT start it.
// index.js starts the server. Tests will load this file directly, so they
// can send requests to the app without opening a real port.

const path = require('path');
const express = require('express');

// Loading db.js opens the database connection when the app is built.
// Nothing here uses it yet; the feature routes will.
require('./db');

const homeRoutes = require('./routes/home');

const app = express();

// Use EJS to turn the templates in views/ into HTML pages.
// __dirname is the folder this file is in, so the paths work no matter
// where the app is started from.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve the files in public/ (such as style.css) straight to the browser
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON payloads from incoming requests
app.use(express.json());

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

// Each feature gets its own file in routes/ and is plugged in here.
app.use('/', homeRoutes);

// Share the app with index.js and the tests
module.exports = app;
