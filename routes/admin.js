// routes/admin.js
// Routes for the admin pages (PRD section 4.5).
// app.js plugs this router in at /admin, behind the login check AND the
// admin check, so every route in this file is for admins only.
// Because of that, the addresses below are written without "/admin":
// router.get('/') here answers the address /admin.

const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------
// 1. SETTINGS FOR THE LISTS
// ---------------------------------------------------------

// The lists an admin manages. They all work the same way (a table with an
// id and a unique name), so the routes in section 3 are written ONCE and
// set up for each list in this table.
//
// IMPORTANT: "table" is put straight into the SQL, because a table name
// cannot be a ? placeholder (placeholders are for values only). That is
// safe ONLY because these names are typed here by us. A table name must
// never come from the address bar or a form.
//
// Each list has:
//   path      the address, e.g. 'courses' -> /admin/courses
//   table     the database table
//   title     the page heading
//   singular  the word for one entry, used in messages
//   inUse     (optional) SQL that counts the students using an entry. If
//             any are, the entry cannot be removed, and inUseMessage says why.
//             (Messages are worded to read correctly for any list and any
//             number, so the page never says "a interest" or "1 students".)
const LISTS = [
  {
    path: 'courses',
    table: 'courses',
    title: 'Courses',
    singular: 'course',
    // A course cannot be removed while students are on it. (The database
    // would refuse anyway, because users.course_id points at it; checking
    // first lets us show a clear message instead of an error page.)
    inUse: 'SELECT COUNT(*) AS total FROM users WHERE course_id = ?',
    inUseMessage: 'This course cannot be removed while students are on it.',
  },
  {
    path: 'interests',
    table: 'interests',
    title: 'Interests',
    singular: 'interest',
    // No inUse: removing an interest also removes everyone's tick for it
    // (ON DELETE CASCADE in schema.sql)
  },
];

// The longest name an admin may give an entry
const NAME_MAX_LENGTH = 100;

// ---------------------------------------------------------
// 2. ADMIN HOME
// ---------------------------------------------------------

// 1. ADMIN HOME: The starting page for admins, linking to each admin section
router.get('/', (req, res) => {
  // The page builds its links from LISTS, so a new list gets a link too
  res.render('admin', { lists: LISTS });
});

// ---------------------------------------------------------
// 3. LIST ROUTES (set up once for each list in LISTS)
// ---------------------------------------------------------

// Fetches every entry in a list, in alphabetical order
function getRows(list) {
  return db.prepare(`SELECT id, name FROM ${list.table} ORDER BY name`).all();
}

// Shows a list page. Used for the first visit, and again (with status 400
// "Bad Request") when an add or remove was refused.
// errors is a list of messages; value is what the admin typed, so the add
// form can be refilled.
function renderList(res, list, errors = [], value = '', status = 200) {
  res.status(status).render('admin-list', { list, rows: getRows(list), errors, value });
}

// A "for...of" loop over LISTS: everything inside runs once for courses,
// then once for interests, each time with "list" set to that list's settings
for (const list of LISTS) {
  // 2. SHOW A LIST: e.g. GET /admin/courses
  router.get(`/${list.path}`, (req, res) => {
    renderList(res, list);
  });

  // 3. ADD AN ENTRY: e.g. POST /admin/courses, from the add form
  router.post(`/${list.path}`, (req, res) => {
    // "|| ''" copes with the field being missing; trim() removes spaces
    // typed by accident at the start or end
    const name = (req.body.name || '').trim();

    // 3a. Check the name, collecting every problem in a list
    const errors = [];
    if (!name) {
      errors.push(`Type a name for the new ${list.singular}.`);
    } else if (name.length > NAME_MAX_LENGTH) {
      errors.push(`The name must be ${NAME_MAX_LENGTH} characters or fewer.`);
    } else {
      // COLLATE NOCASE ignores upper and lower case, so 'fintech' counts
      // as a copy of 'Fintech'
      const copy = db
        .prepare(`SELECT id FROM ${list.table} WHERE name = ? COLLATE NOCASE`)
        .get(name);
      if (copy) {
        errors.push(`"${name}" is already in the list.`);
      }
    }

    if (errors.length > 0) {
      return renderList(res, list, errors, name, 400);
    }

    // 3b. Save it. The name goes in through a ? placeholder, as always.
    db.prepare(`INSERT INTO ${list.table} (name) VALUES (?)`).run(name);

    // Send the browser back to the list page with a GET request. This is
    // called "Post/Redirect/Get": refreshing the page afterwards does not
    // send the form again and add the entry twice.
    res.redirect(`/admin/${list.path}`);
  });

  // 4. REMOVE AN ENTRY: e.g. POST /admin/courses/3/remove, from a Remove button.
  // It is a POST, not a link (GET), because it changes data: browsers and
  // tools may open links on their own, but never send forms on their own.
  // ":id" is a "route parameter": Express puts that part of the address
  // in req.params.id.
  router.post(`/${list.path}/:id/remove`, (req, res) => {
    const id = Number(req.params.id);

    // 4a. Is it still in use? (Only lists with an inUse setting check this.)
    if (list.inUse) {
      const { total } = db.prepare(list.inUse).get(id);
      if (total > 0) {
        return renderList(res, list, [`${list.inUseMessage} Students on it: ${total}.`], '', 400);
      }
    }

    // 4b. Remove it. If the entry was already gone (for example the button
    // was clicked twice), this deletes nothing, which is fine.
    db.prepare(`DELETE FROM ${list.table} WHERE id = ?`).run(id);

    res.redirect(`/admin/${list.path}`);
  });
}

// Share the router with app.js
module.exports = router;
