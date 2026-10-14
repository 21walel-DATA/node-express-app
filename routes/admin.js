// routes/admin.js
// Routes for the admin pages (PRD section 4.5).
// app.js plugs this router in at /admin, behind the login check AND the
// admin check, so every route in this file is for admins only.
// Because of that, the addresses below are written without "/admin":
// router.get('/') here answers the address /admin.

const express = require('express');
const db = require('../db');
// The shared "delete a user" function, also used by the Account page (06)
const { deleteUser } = require('../accounts');

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
//   note      (optional) a sentence shown on the page, saying what removing
//             an entry does
//   parent    (optional) for a list whose entries each belong to an entry
//             of another list, like a skill belonging to a category:
//               table   the other list's table
//               column  the column in this table holding the other id
//               label   the word shown on the page, e.g. 'Category'
//             The add form then has a dropdown to choose one, and the
//             list page shows it next to each entry.
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
    note: 'A course can only be removed when no students are on it.',
  },
  {
    path: 'categories',
    table: 'categories',
    title: 'Categories',
    singular: 'category',
    // No inUse: removing a category keeps its skills, which are left with
    // no category (ON DELETE SET NULL in schema.sql)
    note: 'Removing a category keeps its skills. They are listed under "No category" until you add them again under another one.',
  },
  {
    path: 'skills',
    table: 'skills',
    title: 'Skills',
    singular: 'skill',
    // Each skill belongs to a category (PRD section 4.5), and the profile
    // form shows skills under their category heading
    parent: { table: 'categories', column: 'category_id', label: 'Category' },
    note: 'Removing a skill also removes it from every student who ticked it.',
  },
  {
    path: 'interests',
    table: 'interests',
    title: 'Interests',
    singular: 'interest',
    // No inUse: removing an interest also removes everyone's tick for it
    // (ON DELETE CASCADE in schema.sql)
    note: 'Removing an interest also removes it from every student who ticked it.',
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

// Fetches every entry in a list, in alphabetical order.
// For a list with a parent (skills), each row also gets parentName, the
// name of its category. LEFT JOIN keeps a skill even when it has no
// category; its parentName is then null.
function getRows(list) {
  if (list.parent) {
    return db
      .prepare(
        `SELECT child.id, child.name, parent.name AS parentName
         FROM ${list.table} AS child
         LEFT JOIN ${list.parent.table} AS parent ON parent.id = child.${list.parent.column}
         ORDER BY child.name`
      )
      .all();
  }

  return db.prepare(`SELECT id, name FROM ${list.table} ORDER BY name`).all();
}

// Fetches the choices for the parent dropdown (e.g. every category), or an
// empty list for a list without a parent
function getParentOptions(list) {
  if (!list.parent) {
    return [];
  }
  return db.prepare(`SELECT id, name FROM ${list.parent.table} ORDER BY name`).all();
}

// Shows a list page. Used for the first visit, and again (with status 400
// "Bad Request") when an add or remove was refused.
// errors is a list of messages. values is what the admin typed or chose
// last time ({ name, parentId }), so the add form can be refilled.
function renderList(res, list, errors = [], values = {}, status = 200) {
  res.status(status).render('admin-list', {
    list,
    rows: getRows(list),
    parentOptions: getParentOptions(list),
    errors,
    values,
  });
}

// A "for...of" loop over LISTS: everything inside runs once for each list
// (courses, then categories, and so on), each time with "list" set to that
// list's settings
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

    // 3b. For a list with a parent (skills): a real one must be chosen.
    // Form fields always arrive as text, so Number() turns '3' into 3.
    const parentId = Number(req.body.parent_id);
    if (list.parent) {
      const parent = db.prepare(`SELECT id FROM ${list.parent.table} WHERE id = ?`).get(parentId);
      if (!parent) {
        errors.push(`Choose a ${list.parent.label.toLowerCase()}.`);
      }
    }

    if (errors.length > 0) {
      return renderList(res, list, errors, { name, parentId }, 400);
    }

    // 3c. Save it. The values go in through ? placeholders, as always.
    if (list.parent) {
      db.prepare(`INSERT INTO ${list.table} (name, ${list.parent.column}) VALUES (?, ?)`).run(
        name,
        parentId
      );
    } else {
      db.prepare(`INSERT INTO ${list.table} (name) VALUES (?)`).run(name);
    }

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
        return renderList(res, list, [`${list.inUseMessage} Students on it: ${total}.`], {}, 400);
      }
    }

    // 4b. Remove it. If the entry was already gone (for example the button
    // was clicked twice), this deletes nothing, which is fine.
    db.prepare(`DELETE FROM ${list.table} WHERE id = ?`).run(id);

    res.redirect(`/admin/${list.path}`);
  });
}

// ---------------------------------------------------------
// 4. USER ACCOUNTS
// ---------------------------------------------------------

// Fetches one user's name, or undefined when there is no such user
const findUserQuery = db.prepare('SELECT id, name FROM users WHERE id = ?');

// Shows the users page. Used for the first visit, and again (with an error
// status) when a removal was refused.
function renderUsers(res, errors = [], status = 200) {
  // Every account, in name order. The email is shown so admins can tell
  // two people with the same name apart; this page is for admins only.
  // LEFT JOIN keeps admins, who have no course.
  const users = db
    .prepare(
      `SELECT users.id, users.name, users.email, users.is_admin, courses.name AS course
       FROM users
       LEFT JOIN courses ON courses.id = users.course_id
       ORDER BY users.name`
    )
    .all();

  res.status(status).render('admin-users', { users, errors });
}

// 5. SHOW USERS: GET /admin/users lists every account with a Remove link
router.get('/users', (req, res) => {
  renderUsers(res);
});

// 6. CONFIRM REMOVAL: GET /admin/users/5/remove asks "are you sure?"
// Removing an account cannot be undone, so the Remove link leads here
// first, and only the button on this page really removes it.
router.get('/users/:id/remove', (req, res) => {
  const user = findUserQuery.get(Number(req.params.id));

  // 404 is the HTTP status code for "Not Found"
  if (!user) {
    return renderUsers(res, ['That account no longer exists.'], 404);
  }

  res.render('admin-user-remove', { user });
});

// 7. REMOVE A USER: POST /admin/users/5/remove, from the confirm page
router.post('/users/:id/remove', (req, res) => {
  const id = Number(req.params.id);

  // 7a. An admin cannot remove their own account here. That way the site
  // can never be left with nobody able to open the admin pages.
  if (id === res.locals.currentUser.id) {
    return renderUsers(res, ['You cannot remove your own account here.'], 400);
  }

  // 7b. Delete them, with the shared function (see accounts.js)
  const deleted = deleteUser(id);
  if (!deleted) {
    return renderUsers(res, ['That account no longer exists.'], 404);
  }

  // Back to the users page (Post/Redirect/Get)
  res.redirect('/admin/users');
});

// Share the router with app.js
module.exports = router;
