// matching.js
// Works out a user's top matches for the dashboard (PRD section 4.3).
// Any file that needs it writes:
//   const { findMatches } = require('./matching');
//
// It lives in its own file, not in a route, so the tests can check the
// scoring directly without loading a web page.
//
// How a match is scored:
//   3 points for each skill the other person HAS that the user WANTS
//   2 points for each "looking for" fit (see LOOKING_FOR_FITS below)
//   1 point  for each interest they share
// Every point comes with a reason, so the dashboard can explain the match.

const db = require('./db');

// ---------------------------------------------------------
// 1. SETTINGS
// ---------------------------------------------------------

// Points for each kind of match
const SKILL_POINTS = 3;
const LOOKING_FOR_POINTS = 2;
const INTEREST_POINTS = 1;

// How many matches the dashboard shows
const MAX_MATCHES = 5;

// The pairs of "looking for" ticks that count as a fit.
// mine = what the user ticked, theirs = what the other person ticked.
// The codes are the short names in the looking_for_options table.
// The mentor fit is listed twice, once for each direction, because it
// counts whichever of the two people is the mentor.
const LOOKING_FOR_FITS = [
  {
    mine: 'cofounder',
    theirs: 'cofounder',
    reason: 'You are both looking for a co-founder',
  },
  {
    mine: 'collaborator',
    theirs: 'collaborator',
    reason: 'You are both looking for a project collaborator',
  },
  {
    mine: 'social',
    theirs: 'social',
    reason: 'You both want to meet people socially',
  },
  {
    mine: 'find_mentor',
    theirs: 'be_mentor',
    reason: 'You are looking for a mentor and they want to be one',
  },
  {
    mine: 'be_mentor',
    theirs: 'find_mentor',
    reason: 'You want to be a mentor and they are looking for one',
  },
];

// ---------------------------------------------------------
// 2. THE DATABASE QUERIES
// Each query finds one kind of overlap. They are prepared once here and
// reused on every call. Every value comes in through a ? placeholder.
// ---------------------------------------------------------

// Everyone who is allowed to appear in matches: other students (not
// admins) who have finished the setup step. The user's own id is the ?,
// and "id <> ?" means "id is not equal to", so the user is left out.
// Email is deliberately not selected: it is never shown on the dashboard.
const candidatesQuery = db.prepare(`
  SELECT users.id, users.name, courses.name AS course
  FROM users
  LEFT JOIN courses ON courses.id = users.course_id
  WHERE users.id <> ?
    AND users.setup_complete = 1
    AND users.is_admin = 0
`);

// Skills the user wants that another person has.
// user_skills is joined to itself: "wants" is the user's row and "has" is
// the other person's row, and they are paired up when the skill is the same.
// One result row = one person + one skill = 3 points.
const skillsQuery = db.prepare(`
  SELECT has.user_id, skills.name
  FROM user_skills AS wants
  JOIN user_skills AS has ON has.skill_id = wants.skill_id
  JOIN skills ON skills.id = wants.skill_id
  WHERE wants.user_id = ?
    AND wants.kind = 'wants'
    AND has.kind = 'has'
  ORDER BY skills.name
`);

// Interests the user shares with another person, using the same idea:
// user_interests joined to itself on the same interest.
const interestsQuery = db.prepare(`
  SELECT theirs.user_id, interests.name
  FROM user_interests AS mine
  JOIN user_interests AS theirs ON theirs.interest_id = mine.interest_id
  JOIN interests ON interests.id = mine.interest_id
  WHERE mine.user_id = ?
  ORDER BY interests.name
`);

// Every "looking for" tick in the database, as (user_id, code) rows.
// Comparing ticks is easier in JavaScript, using LOOKING_FOR_FITS above.
const lookingForQuery = db.prepare(`
  SELECT user_looking_for.user_id, looking_for_options.code
  FROM user_looking_for
  JOIN looking_for_options ON looking_for_options.id = user_looking_for.option_id
`);

// ---------------------------------------------------------
// 3. FIND MATCHES
// ---------------------------------------------------------

// Returns the user's top matches, best first, as a list like:
//   [{ id: 4, name: 'Ben', course: 'Business development',
//      score: 5, reasons: ['Has a skill you are looking for: Sales', ...] }]
// Returns an empty list [] when nobody scores any points.
function findMatches(userId) {
  // 3a. Make a "scorecard" for each person who may appear in matches.
  // The scorecards are kept in a Map: a lookup table from a key (here the
  // user id) to a value (here the scorecard), so we can find anyone's
  // scorecard quickly by their id.
  const scorecards = new Map();
  for (const person of candidatesQuery.all(userId)) {
    scorecards.set(person.id, {
      id: person.id,
      name: person.name,
      course: person.course,
      score: 0,
      reasons: [],
    });
  }

  // Adds points and a reason to one person's scorecard.
  // Rows for people without a scorecard (the user themselves, admins, or
  // people who have not finished setup) are simply skipped.
  function addPoints(personId, points, reason) {
    const card = scorecards.get(personId);
    if (!card) {
      return;
    }
    card.score += points;
    card.reasons.push(reason);
  }

  // 3b. Skills: 3 points for each skill they have that the user wants
  for (const row of skillsQuery.all(userId)) {
    addPoints(row.user_id, SKILL_POINTS, `Has a skill you are looking for: ${row.name}`);
  }

  // 3c. "Looking for" fits: 2 points for each fit.
  // First sort every tick into a list per person:
  //   ticksByPerson.get(4) might be ['cofounder', 'social']
  const ticksByPerson = new Map();
  for (const row of lookingForQuery.all()) {
    if (!ticksByPerson.has(row.user_id)) {
      ticksByPerson.set(row.user_id, []);
    }
    ticksByPerson.get(row.user_id).push(row.code);
  }

  // The user's own ticks (an empty list if they ticked nothing)
  const myTicks = ticksByPerson.get(userId) || [];

  // Then check every fit against every other person's ticks
  for (const [personId, theirTicks] of ticksByPerson) {
    for (const fit of LOOKING_FOR_FITS) {
      if (myTicks.includes(fit.mine) && theirTicks.includes(fit.theirs)) {
        addPoints(personId, LOOKING_FOR_POINTS, fit.reason);
      }
    }
  }

  // 3d. Interests: 1 point for each interest they share
  for (const row of interestsQuery.all(userId)) {
    addPoints(row.user_id, INTEREST_POINTS, `You are both interested in ${row.name}`);
  }

  // 3e. Keep only people who scored, best first, top 5.
  // Array.from turns the Map's scorecards into a normal list.
  // filter keeps people with at least 1 point: a match needs a real reason.
  // sort puts the highest score first. When two scores are equal, it uses
  // alphabetical order of name, so the order is always the same.
  // slice(0, 5) keeps the first five.
  return Array.from(scorecards.values())
    .filter((card) => card.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, MAX_MATCHES);
}

// Share the function with the routes and the tests
module.exports = { findMatches };
