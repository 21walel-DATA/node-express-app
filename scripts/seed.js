// scripts/seed.js
// Fills the database with the starter lists (categories, skills, interests)
// and eight made-up students, so there is something to look at and test.
// Run it with: npm run seed
//
// To let people log in as the made-up students, give a demo password in the
// SEED_PASSWORD environment variable. In PowerShell:
//   $env:SEED_PASSWORD='pick-something'; npm run seed
// Without it, the students get a placeholder that no password matches, so
// nobody can log in as them. The password is never written in this file,
// because the code is public on GitHub.
//
// It is safe to run more than once. Every INSERT below is "INSERT OR IGNORE",
// which skips a row that is already there instead of adding a copy.
//
// The students are invented. Their emails end in @example.com, an address
// kept for pretend use that can never reach a real person.

const bcrypt = require('bcryptjs');
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

// Used when no demo password is given. It is not a real scrambled
// password, so bcrypt never finds a match and nobody can log in.
const PLACEHOLDER_PASSWORD_HASH = 'seed-placeholder-not-a-real-hash';

// How much work bcrypt does when it scrambles the demo password.
// The same strength as the registration form in routes/auth.js.
const BCRYPT_ROUNDS = 10;

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

// passwordHash is the scrambled password every made-up student gets
function fillDatabase(passwordHash) {
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
      passwordHash,
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
const fillInTransaction = db.transaction(fillDatabase);

// Fills the database. password is the demo password for the made-up
// students; leave it out and they get the placeholder instead.
function seed(password) {
  // Scramble the password once, before the transaction starts, and give
  // every student the same hash. Hashing is slow on purpose, so doing it
  // once instead of eight times keeps the seed quick.
  const passwordHash = password
    ? bcrypt.hashSync(password, BCRYPT_ROUNDS)
    : PLACEHOLDER_PASSWORD_HASH;

  fillInTransaction(passwordHash);
}

// ---------------------------------------------------------
// 5. RUNNING THE SCRIPT
// ---------------------------------------------------------

// This is true only when the file is run directly (npm run seed).
// When a test loads the file with require, nothing runs until the test
// calls seed() itself.
if (require.main === module) {
  // process.env holds the environment variables. SEED_PASSWORD is
  // undefined when it was not set.
  seed(process.env.SEED_PASSWORD);
  console.log(`Seed finished: ${STUDENTS.length} made-up students are in the database.`);

  // Say clearly which password the students got, without printing it
  if (process.env.SEED_PASSWORD) {
    console.log('They can log in with the password in SEED_PASSWORD.');
  } else {
    console.log('SEED_PASSWORD was not set, so nobody can log in as them.');
  }
}

// Share the function so the tests can call it
module.exports = seed;
