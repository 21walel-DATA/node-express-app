// app.js
// Builds the Express app (middleware and routes) but does NOT start it.
// index.js starts the server. Tests will load this file directly, so they
// can send requests to the app without opening a real port.

const path = require('path');
const express = require('express');
// express-session remembers who is logged in between page loads
const session = require('express-session');

// Loading db.js opens the database connection when the app is built.
require('./db');

// Our store that keeps sessions in the SQLite database
const SqliteStore = require('./sessionStore');

// Middleware that works out who is logged in, the "must be logged in" check
// and the "must be an admin" check
const { loadCurrentUser, requireLogin, requireAdmin } = require('./middleware/auth');

const homeRoutes = require('./routes/home');
const adminRoutes = require('./routes/admin');
const privacyRoutes = require('./routes/privacy');
const authRoutes = require('./routes/auth');

const app = express();

// How long a login lasts: 7 days, written in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// On Railway the app sits behind a "proxy": Railway's own server receives
// the HTTPS request and passes it on to us. This setting tells Express to
// believe the proxy when it says the visitor used HTTPS.
app.set('trust proxy', 1);

// Use EJS to turn the templates in views/ into HTML pages.
// __dirname is the folder this file is in, so the paths work no matter
// where the app is started from.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve the files in public/ (such as style.css) straight to the browser
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON payloads from incoming requests
app.use(express.json());

// Middleware to read HTML form submissions. A form sends its fields as
// "name=Sam&email=sam%40x.com"; this turns that into req.body.name and
// req.body.email. extended: false means plain text fields only.
app.use(express.urlencoded({ extended: false }));

// Middleware that gives every request a req.session object.
// Whatever we put on req.session (for example the logged-in user's id) is
// saved in the database, and the browser only gets a cookie holding a
// random session id.
app.use(
  session({
    // Where sessions are saved
    store: new SqliteStore(),
    // The secret signs the cookie so nobody can forge a session id.
    // On Railway it comes from the SESSION_SECRET environment variable.
    // The fallback is for laptops and tests only.
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    // Do not save a session again when nothing in it changed
    resave: false,
    // Do not create a session (or a cookie) until we store something in it,
    // so visitors who never log in get no cookie
    saveUninitialized: false,
    cookie: {
      // JavaScript running in the page cannot read the cookie
      httpOnly: true,
      // The browser does not send the cookie with form posts from other sites
      sameSite: 'lax',
      // 'auto' = send the cookie over HTTPS only when the site is on HTTPS
      // (Railway), and still work on plain http://localhost
      secure: 'auto',
      maxAge: SEVEN_DAYS_MS,
    },
  })
);

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

// Each feature gets its own file in routes/ and is plugged in here.
// ORDER MATTERS: Express runs these lines from top to bottom for every
// request, so a route's position decides which checks run before it.

// Work out who is logged in. This runs for every page, public or not, so
// the header can show the right links everywhere.
app.use(loadCurrentUser);

// PUBLIC PAGES: these sit above the login check, so anyone can open them
// (PRD section 8: only register, login and the privacy notice).
app.use('/', privacyRoutes);
app.use('/', authRoutes);

// THE LOGIN CHECK: everything below this line needs a logged-in user.
// A logged-out visitor is sent to /login and never reaches the routes below.
app.use(requireLogin);

// ADMIN PAGES: every address starting with /admin.
// requireAdmin runs first and refuses non-admins with "403 Forbidden", so
// the admin routes only ever run for admins.
// These sit ABOVE the profile setup gate below, because admins are
// organisers, not students, and never fill in a student profile.
app.use('/admin', requireAdmin, adminRoutes);

// FEATURE 02 (Koulla): the "finish your profile setup" gate and the profile
// routes go here, directly after the login check.

// LOGGED-IN PAGES
app.use('/', homeRoutes);

// Share the app with index.js and the tests
module.exports = app;
