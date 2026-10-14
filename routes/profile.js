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

// The longest a bio or business idea may be (PRD section 4.2)
const TEXT_MAX_LENGTH = 500;

// Turns one group of tick boxes from the form into a list of numbers.
// A browser sends nothing when no box is ticked, plain text ('3') when one
// is ticked, and a list (['3', '7']) when several are. This always gives
// back a list: [], [3] or [3, 7].
// Text that is not a number (like 'abc') becomes NaN ("not a number"),
// which the "is it on the list" check then refuses.
function toIdList(value) {
  if (value === undefined) {
    return [];
  }
  const items = Array.isArray(value) ? value : [value];

  // new Set(...) drops repeats, so the same tick cannot be saved twice
  return [...new Set(items.map(Number))];
}

// Tidies a text box: a new line sent as \r\n counts as ONE character (the
// same as the browser counts it), and spaces at both ends are removed.
function cleanText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim();
}

// Checks that every id is a real row. "statement" is a prepared query
// that looks up one id, for example "SELECT id FROM skills WHERE id = ?".
// .every() is true only if the check passes for ALL the ids.
function allExist(statement, ids) {
  return ids.every((id) => Number.isInteger(id) && statement.get(id) !== undefined);
}

// One prepared query for each list, used by allExist
const findLookingFor = db.prepare('SELECT id FROM looking_for_options WHERE id = ?');
const findSkill = db.prepare('SELECT id FROM skills WHERE id = ?');
const findInterest = db.prepare('SELECT id FROM interests WHERE id = ?');

// Saves a checked profile. db.transaction makes it "all or nothing": if any
// line fails, every change is undone, so a profile is never half saved.
const saveProfile = db.transaction((userId, profile) => {
  // The texts, and setup is now finished.
  // "|| null" saves an empty text as "nothing" (null).
  db.prepare(
    'UPDATE users SET bio = ?, business_idea = ?, setup_complete = 1 WHERE id = ?'
  ).run(profile.bio || null, profile.businessIdea || null, userId);

  // Wipe the old ticks, then add the new ones. This is the simplest way to
  // make an unticked box disappear.
  db.prepare('DELETE FROM user_looking_for WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(userId);

  const addLookingFor = db.prepare('INSERT INTO user_looking_for (user_id, option_id) VALUES (?, ?)');
  const addSkill = db.prepare('INSERT INTO user_skills (user_id, skill_id, kind) VALUES (?, ?, ?)');
  const addInterest = db.prepare('INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)');

  for (const id of profile.lookingFor) {
    addLookingFor.run(userId, id);
  }
  for (const id of profile.skillsHas) {
    addSkill.run(userId, id, 'has');
  }
  for (const id of profile.skillsWants) {
    addSkill.run(userId, id, 'wants');
  }
  for (const id of profile.interests) {
    addInterest.run(userId, id);
  }
});

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
    // No problems to show: the form has not been sent yet
    errors: [],
  });
});

// 2. SAVE PROFILE: Check the sent form, then save it or show it again.
// Like the form above, it always saves to the LOGGED-IN user. Any id the
// browser sends is ignored, so nobody can change someone else's profile.
router.post('/profile/edit', (req, res) => {
  const userId = res.locals.currentUser.id;

  // req.body holds the form fields. It is undefined if no form was sent,
  // so fall back to an empty object to avoid a crash.
  const body = req.body || {};

  // Read every field into the same shape the form page uses
  const profile = {
    lookingFor: toIdList(body.looking_for),
    skillsHas: toIdList(body.skills_has),
    skillsWants: toIdList(body.skills_wants),
    interests: toIdList(body.interests),
    bio: cleanText(body.bio),
    businessIdea: cleanText(body.business_idea),
  };

  // Collect every problem, so the person sees them all at once
  const errors = [];

  // Rule 1: at least one tick in each list
  if (profile.lookingFor.length === 0) {
    errors.push('Tick at least one thing you are looking for.');
  }
  if (profile.skillsHas.length === 0) {
    errors.push('Tick at least one skill you have.');
  }
  if (profile.skillsWants.length === 0) {
    errors.push('Tick at least one skill you are looking for.');
  }
  if (profile.interests.length === 0) {
    errors.push('Tick at least one interest.');
  }

  // Rule 2: every tick is a real item from the lists.
  // Never trust that the browser only sends the boxes we showed it.
  const allTicksReal =
    allExist(findLookingFor, profile.lookingFor) &&
    allExist(findSkill, profile.skillsHas) &&
    allExist(findSkill, profile.skillsWants) &&
    allExist(findInterest, profile.interests);
  if (!allTicksReal) {
    errors.push('One of the ticks is not on the lists. Please try again.');
  }

  // Rule 3: the texts are not too long
  if (profile.bio.length > TEXT_MAX_LENGTH) {
    errors.push(`Your bio must be ${TEXT_MAX_LENGTH} characters or fewer.`);
  }
  if (profile.businessIdea.length > TEXT_MAX_LENGTH) {
    errors.push(`Your business idea must be ${TEXT_MAX_LENGTH} characters or fewer.`);
  }

  // If anything was wrong, show the form again with the messages and the
  // person's own answers, so they do not have to start again.
  // 400 is the HTTP status code for "Bad Request".
  if (errors.length > 0) {
    return res.status(400).render('profile-form', {
      ...getFormLists(),
      values: profile,
      errors,
    });
  }

  saveProfile(userId, profile);

  // Setup is finished, so go to the home page (agreed with Walied).
  // Feature 03 made it the dashboard.
  res.redirect('/');
});

// 3. PROFILE PAGE: Show one person's profile.
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
