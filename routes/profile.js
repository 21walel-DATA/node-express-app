// routes/profile.js
// Routes for feature 02, Profiles (see specs/02-profiles.md).
// For now this holds the profile page. The profile form comes next.

const express = require('express');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

// Works out the letters for the coloured initials circle.
// 'Sam Taylor' -> 'ST', 'Ada May Lane' -> 'AL', 'Cher' -> 'C'
function getInitials(name) {
  // Split the name at spaces. filter(Boolean) drops empty pieces, which
  // appear when a name has two spaces in a row.
  const words = name.trim().split(' ').filter(Boolean);

  const first = words[0][0];
  // Only add a second letter when there is more than one word
  const last = words.length > 1 ? words[words.length - 1][0] : '';

  return (first + last).toUpperCase();
}

// Turns a flat list of skills into groups, one per category.
// In:  [{ id: 1, name: 'Sales', category: 'Business' }, { id: 2, name: 'Pitching', category: 'Business' }]
// Out: [{ category: 'Business', skills: [{ id: 1, name: 'Sales' }, { id: 2, name: 'Pitching' }] }]
// Each skill keeps its id as well as its name, because a tick box on the
// form sends back the id.
// The rows must already be sorted by category, so each group's skills sit
// next to each other.
function groupByCategory(rows) {
  const groups = [];

  for (const row of rows) {
    // A skill whose category was deleted has no category (null)
    const category = row.category || 'Other';
    const skill = { id: row.id, name: row.name };
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.category === category) {
      // Same category as the skill before: add it to that group
      lastGroup.skills.push(skill);
    } else {
      // A new category: start a new group
      groups.push({ category, skills: [skill] });
    }
  }

  return groups;
}

// Reads one kind of skill ('has' or 'wants') for a user, grouped by category
function getSkills(userId, kind) {
  // LEFT JOIN keeps a skill even when it has no category.
  // "categories.name IS NULL" is 0 or 1, so sorting by it first puts the
  // skills without a category at the end.
  const rows = db
    .prepare(
      `SELECT skills.id, skills.name, categories.name AS category
       FROM user_skills
       JOIN skills ON skills.id = user_skills.skill_id
       LEFT JOIN categories ON categories.id = skills.category_id
       WHERE user_skills.user_id = ? AND user_skills.kind = ?
       ORDER BY categories.name IS NULL, categories.name, skills.name`
    )
    .all(userId, kind);

  return groupByCategory(rows);
}

// Reads the full lists the form offers as tick boxes: every "looking for"
// option, every skill (grouped by category) and every interest.
// Admins manage these lists (feature 05), so they can be empty.
function getFormLists() {
  const lookingForOptions = db
    .prepare('SELECT id, label FROM looking_for_options ORDER BY id')
    .all();

  // The same sorting as getSkills, but for ALL skills, not one user's
  const skillRows = db
    .prepare(
      `SELECT skills.id, skills.name, categories.name AS category
       FROM skills
       LEFT JOIN categories ON categories.id = skills.category_id
       ORDER BY categories.name IS NULL, categories.name, skills.name`
    )
    .all();

  const interestOptions = db.prepare('SELECT id, name FROM interests ORDER BY name').all();

  return {
    lookingForOptions,
    skillGroups: groupByCategory(skillRows),
    interestOptions,
  };
}

// Reads what a user saved before, in the shape the form uses:
// lists of id numbers for the ticks, and the two texts.
function getSavedValues(userId) {
  const user = db.prepare('SELECT bio, business_idea FROM users WHERE id = ?').get(userId);

  // .all() gives rows like { id: 3 }; .map keeps just the numbers
  const lookingFor = db
    .prepare('SELECT option_id AS id FROM user_looking_for WHERE user_id = ?')
    .all(userId)
    .map((row) => row.id);
  const skillsHas = db
    .prepare("SELECT skill_id AS id FROM user_skills WHERE user_id = ? AND kind = 'has'")
    .all(userId)
    .map((row) => row.id);
  const skillsWants = db
    .prepare("SELECT skill_id AS id FROM user_skills WHERE user_id = ? AND kind = 'wants'")
    .all(userId)
    .map((row) => row.id);
  const interests = db
    .prepare('SELECT interest_id AS id FROM user_interests WHERE user_id = ?')
    .all(userId)
    .map((row) => row.id);

  return {
    lookingFor,
    skillsHas,
    skillsWants,
    interests,
    // "|| ''" shows an empty box when nothing was saved (null)
    bio: user.bio || '',
    businessIdea: user.business_idea || '',
  };
}

// ---------------------------------------------------------
// PROFILE ROUTES
// ---------------------------------------------------------

// ORDER MATTERS: /profile/edit must stay ABOVE /profile/:id.
// Express tries routes from top to bottom, and ":id" would happily take
// the word "edit" as a person's number.

// 1. PROFILE FORM: Show the form, filled in with what the user saved before.
// There is no id in the address: the form always belongs to the logged-in
// user, so nobody can open someone else's form.
router.get('/profile/edit', (req, res) => {
  const userId = res.locals.currentUser.id;

  res.render('profile-form', {
    // The tick box lists: lookingForOptions, skillGroups, interestOptions
    ...getFormLists(),
    // What to tick and fill in
    values: getSavedValues(userId),
    // No problems to show yet. Step 3 (saving) fills this in when the
    // form is refused.
    errors: [],
  });
});

// 2. PROFILE PAGE: Show one person's profile.
// ":id" is a gap in the address. For /profile/7, req.params.id is '7'.
// app.js puts this router below the login check, so only logged-in users
// reach it, and res.locals.currentUser is always set.
router.get('/profile/:id', (req, res) => {
  const currentUser = res.locals.currentUser;

  // Everything in an address is text. Only accept whole numbers made of
  // digits, so '/profile/abc' or '/profile/7.5' is simply "not found".
  // /^\d+$/ means "from start (^) to end ($), one or more digits (\d+)".
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).render('profile', { profile: null });
  }
  const id = Number(req.params.id);

  // Read the person and the name of their course.
  // The email and password hash are NOT selected, so they can never
  // reach the page by mistake.
  const profile = db
    .prepare(
      `SELECT users.id, users.name, users.bio, users.business_idea,
              users.setup_complete, courses.name AS course
       FROM users
       LEFT JOIN courses ON courses.id = users.course_id
       WHERE users.id = ?`
    )
    .get(id);

  // Is the logged-in user looking at their own page?
  // "profile &&" stops this line from failing when nobody was found.
  const isOwnProfile = Boolean(profile) && profile.id === currentUser.id;

  // "Profile not found" when nobody has this id, or when the person has
  // not finished setup and someone else is looking (spec decision).
  // 404 is the HTTP status code for "Not Found".
  if (!profile || (profile.setup_complete === 0 && !isOwnProfile)) {
    return res.status(404).render('profile', { profile: null });
  }

  // The "looking for" options they ticked, in the fixed list's order
  const lookingFor = db
    .prepare(
      `SELECT looking_for_options.label
       FROM user_looking_for
       JOIN looking_for_options ON looking_for_options.id = user_looking_for.option_id
       WHERE user_looking_for.user_id = ?
       ORDER BY looking_for_options.id`
    )
    .all(id)
    // .all() gives rows like { label: '...' }; keep just the text
    .map((row) => row.label);

  // The interests they ticked, A to Z
  const interests = db
    .prepare(
      `SELECT interests.name
       FROM user_interests
       JOIN interests ON interests.id = user_interests.interest_id
       WHERE user_interests.user_id = ?
       ORDER BY interests.name`
    )
    .all(id)
    .map((row) => row.name);

  // Hand everything to views/profile.ejs
  res.render('profile', {
    profile,
    isOwnProfile,
    initials: getInitials(profile.name),
    lookingFor,
    skillsHas: getSkills(id, 'has'),
    skillsWants: getSkills(id, 'wants'),
    interests,
  });
});

// Share the router with app.js
module.exports = router;
