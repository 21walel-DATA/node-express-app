// scripts/seed.js
// Fills the database with the starter lists (categories, skills, interests)
// and eight made-up students, so there is something to look at and test.
// Run it with: npm run seed
//
// It is safe to run more than once. Every INSERT below is "INSERT OR IGNORE",
// which skips a row that is already there instead of adding a copy.
//
// The students are invented. Their emails end in @example.com, an address
// kept for pretend use that can never reach a real person.

const db = require('../db');

// ---------------------------------------------------------
// 1. THE STARTER LISTS
// ---------------------------------------------------------

// Each category with the skills that belong to it
const CATEGORIES = [
  {
    name: 'Coding',
    skills: ['HTML and CSS', 'JavaScript', 'Databases (SQL)', 'Testing'],
  },
  {
    name: 'Design',
    skills: ['Graphic design', 'User experience (UX) design', 'Branding'],
  },
  {
    name: 'Marketing',
    skills: ['Social media', 'Content writing', 'Market research'],
  },
  {
    name: 'Business',
    skills: ['Business planning', 'Finance and budgeting', 'Sales', 'Pitching'],
  },
  {
    name: 'People and organisation',
    skills: ['Project management', 'Public speaking', 'Team leadership'],
  },
];

const INTERESTS = [
  'Startups',
  'Social enterprise',
  'Sustainability',
  'Health and wellbeing',
  'Education',
  'Fintech',
  'E-commerce',
  'Gaming',
  'Artificial intelligence',
  'Arts and culture',
];

// ---------------------------------------------------------
// 2. THE MADE-UP STUDENTS
// ---------------------------------------------------------

// The two course names, exactly as schema.sql adds them
const SOFTWARE = 'Software development';
const BUSINESS = 'Business development';

// Stored in place of a scrambled password. It is not a real scrambled
// password, so nobody can log in as a made-up student yet.
// TODO: once feature 01 (login) is merged, replace this with a real hash of
// a shared demo password.
const PLACEHOLDER_PASSWORD_HASH = 'seed-placeholder-not-a-real-hash';

// lookingFor uses the short codes from the looking_for_options table:
// cofounder, collaborator, find_mentor, be_mentor, social.
// has = skills they have. wants = skills they are looking for.
const STUDENTS = [
  {
    name: 'Ada Example',
    email: 'ada@example.com',
    course: SOFTWARE,
    bio: 'I like building small web apps and want to turn one into a business.',
    businessIdea: null,
    lookingFor: ['cofounder', 'collaborator'],
    has: ['JavaScript', 'Databases (SQL)'],
    wants: ['Business planning', 'Pitching'],
    interests: ['Startups', 'Fintech'],
  },
  {
    name: 'Ben Sample',
    email: 'ben@example.com',
    course: SOFTWARE,
    bio: 'New to coding and looking for someone to learn from.',
    businessIdea: null,
    lookingFor: ['find_mentor', 'social'],
    has: ['HTML and CSS'],
    wants: ['JavaScript', 'Testing'],
    interests: ['Gaming', 'Artificial intelligence'],
  },
  {
    name: 'Cleo Demo',
    email: 'cleo@example.com',
    course: SOFTWARE,
    bio: 'Happy to help newer coders, and I need a designer for a side project.',
    businessIdea: null,
    lookingFor: ['be_mentor', 'collaborator'],
    has: ['JavaScript', 'Testing', 'Project management'],
    wants: ['Graphic design', 'Branding'],
    interests: ['Education', 'Artificial intelligence'],
  },
  {
    name: 'Dev Placeholder',
    email: 'dev@example.com',
    course: SOFTWARE,
    bio: 'I enjoy making pages look good. Here to meet people.',
    businessIdea: null,
    lookingFor: ['social'],
    has: ['HTML and CSS', 'User experience (UX) design'],
    wants: ['Social media'],
    interests: ['Arts and culture', 'Gaming'],
  },
  {
    name: 'Ezra Madeup',
    email: 'ezra@example.com',
    course: BUSINESS,
    bio: 'I have a business plan and need someone technical to build it with me.',
    businessIdea: 'A budgeting app that helps students split shared house bills.',
    lookingFor: ['cofounder'],
    has: ['Business planning', 'Pitching', 'Finance and budgeting'],
    wants: ['JavaScript', 'Databases (SQL)'],
    interests: ['Startups', 'Fintech'],
  },
  {
    name: 'Faye Pretend',
    email: 'faye@example.com',
    course: BUSINESS,
    bio: 'I write and run social media, and want to learn how to lead a team.',
    businessIdea: null,
    lookingFor: ['collaborator', 'find_mentor'],
    has: ['Social media', 'Content writing'],
    wants: ['Team leadership', 'HTML and CSS'],
    interests: ['Sustainability', 'Social enterprise'],
  },
  {
    name: 'Gus Fictional',
    email: 'gus@example.com',
    course: BUSINESS,
    bio: 'Years in sales before this course. Glad to mentor.',
    businessIdea: 'An online shop for second-hand course books.',
    lookingFor: ['be_mentor', 'cofounder'],
    has: ['Sales', 'Team leadership', 'Public speaking'],
    wants: ['User experience (UX) design', 'Branding'],
    interests: ['E-commerce', 'Startups'],
  },
  {
    name: 'Hana Test',
    email: 'hana@example.com',
    course: BUSINESS,
    bio: 'I like finding out what customers really want.',
    businessIdea: null,
    lookingFor: ['social'],
    has: ['Market research'],
    wants: ['Graphic design'],
    interests: ['Health and wellbeing', 'Arts and culture'],
  },
];

// ---------------------------------------------------------
// 3. A HELPER
// ---------------------------------------------------------

// Runs a "SELECT id ..." statement and returns the id it finds.
// If nothing is found, it stops with a clear message. This catches a
// spelling mistake in the lists above (for example 'Javascript').
function findId(statement, value, what) {
  const row = statement.get(value);
  if (!row) {
    throw new Error(`Seed script: no ${what} called "${value}"`);
  }
  return row.id;
}

// ---------------------------------------------------------
// 4. FILLING THE DATABASE
// ---------------------------------------------------------

function fillDatabase() {
  // Prepared statements. Each ? is filled in later with a real value, so
  // the values can never be mistaken for SQL.
  const addCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  const addSkill = db.prepare('INSERT OR IGNORE INTO skills (name, category_id) VALUES (?, ?)');
  const addInterest = db.prepare('INSERT OR IGNORE INTO interests (name) VALUES (?)');
  const addUser = db.prepare(
    `INSERT OR IGNORE INTO users
       (name, email, password_hash, course_id, bio, business_idea,
        setup_complete, privacy_agreed_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`
  );
  const addLookingFor = db.prepare(
    'INSERT OR IGNORE INTO user_looking_for (user_id, option_id) VALUES (?, ?)'
  );
  const addUserSkill = db.prepare(
    'INSERT OR IGNORE INTO user_skills (user_id, skill_id, kind) VALUES (?, ?, ?)'
  );
  const addUserInterest = db.prepare(
    'INSERT OR IGNORE INTO user_interests (user_id, interest_id) VALUES (?, ?)'
  );

  // Statements that look up the id number of a row by its name
  const categoryId = db.prepare('SELECT id FROM categories WHERE name = ?');
  const skillId = db.prepare('SELECT id FROM skills WHERE name = ?');
  const interestId = db.prepare('SELECT id FROM interests WHERE name = ?');
  const courseId = db.prepare('SELECT id FROM courses WHERE name = ?');
  const optionId = db.prepare('SELECT id FROM looking_for_options WHERE code = ?');
  const userId = db.prepare('SELECT id FROM users WHERE email = ?');

  // 4a. Categories, and the skills inside each one
  for (const category of CATEGORIES) {
    addCategory.run(category.name);
    const id = findId(categoryId, category.name, 'category');

    for (const skill of category.skills) {
      addSkill.run(skill, id);
    }
  }

  // 4b. Interests
  for (const interest of INTERESTS) {
    addInterest.run(interest);
  }

  // 4c. Students, and everything each one ticked
  for (const student of STUDENTS) {
    addUser.run(
      student.name,
      student.email,
      PLACEHOLDER_PASSWORD_HASH,
      findId(courseId, student.course, 'course'),
      student.bio,
      student.businessIdea
    );

    // The database chose the student's id, so ask for it by email
    const id = findId(userId, student.email, 'user');

    for (const code of student.lookingFor) {
      addLookingFor.run(id, findId(optionId, code, '"looking for" option'));
    }
    for (const skill of student.has) {
      addUserSkill.run(id, findId(skillId, skill, 'skill'), 'has');
    }
    for (const skill of student.wants) {
      addUserSkill.run(id, findId(skillId, skill, 'skill'), 'wants');
    }
    for (const interest of student.interests) {
      addUserInterest.run(id, findId(interestId, interest, 'interest'));
    }
  }
}

// db.transaction wraps the work so it is "all or nothing": if any step
// fails, everything this run added is undone, and the database is never
// left half filled.
const seed = db.transaction(fillDatabase);

// ---------------------------------------------------------
// 5. RUNNING THE SCRIPT
// ---------------------------------------------------------

// This is true only when the file is run directly (npm run seed).
// When a test loads the file with require, nothing runs until the test
// calls seed() itself.
if (require.main === module) {
  seed();
  console.log(`Seed finished: ${STUDENTS.length} made-up students are in the database.`);
}

// Share the function so the tests can call it
module.exports = seed;
