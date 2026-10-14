-- schema.sql
-- Every table the app uses. db.js runs this whole file each time the app starts.
-- "CREATE TABLE IF NOT EXISTS" means: make the table only if it is missing,
-- so running this file again and again is safe and never deletes data.
--
-- Words used below:
--   PRIMARY KEY  the column that uniquely identifies a row (its id number)
--   REFERENCES   a "foreign key": this column must hold the id of a real row
--                in another table
--   ON DELETE CASCADE  when the row it points to is deleted, delete this row too
--   UNIQUE       no two rows may have the same value
--   NOT NULL     the value may not be left empty
--   CHECK        a rule the value must pass

-- ---------------------------------------------------------
-- 1. LISTS MANAGED BY ADMINS
-- ---------------------------------------------------------

-- The bootcamp courses a student can choose at registration
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Categories group skills, for example "Design" or "Marketing"
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Skills a student can tick. Each skill belongs to one category.
-- If its category is deleted, the skill stays and its category becomes empty.
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

-- Interests a student can tick
CREATE TABLE IF NOT EXISTS interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- ---------------------------------------------------------
-- 2. FIXED LIST: WHAT A STUDENT IS LOOKING FOR
-- ---------------------------------------------------------

-- code is a short name the matching code uses (it never changes).
-- label is the text shown on the page.
CREATE TABLE IF NOT EXISTS looking_for_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

-- ---------------------------------------------------------
-- 3. USERS
-- ---------------------------------------------------------

-- One row per account. The profile fields live here too, because each user
-- has exactly one profile.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  -- COLLATE NOCASE treats Sam@x.com and sam@x.com as the same email
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  -- The scrambled (hashed) password. The real password is never stored.
  password_hash TEXT NOT NULL,
  -- A course cannot be deleted while a user still belongs to it
  course_id INTEGER REFERENCES courses(id),
  -- SQLite has no true/false type, so 0 means no and 1 means yes
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  -- Optional profile fields
  bio TEXT,
  business_idea TEXT,
  photo_filename TEXT,
  -- Becomes 1 once the required profile setup step is finished.
  -- Users with 0 do not appear in matches.
  setup_complete INTEGER NOT NULL DEFAULT 0 CHECK (setup_complete IN (0, 1)),
  -- When the user agreed to the privacy notice
  privacy_agreed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 4. LINKING TABLES: WHAT EACH USER TICKED
-- A user can tick many skills, and a skill can be ticked by many users.
-- That "many to many" link needs its own table with one row per tick.
-- ---------------------------------------------------------

-- Which "looking for" options a user ticked
CREATE TABLE IF NOT EXISTS user_looking_for (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES looking_for_options(id) ON DELETE CASCADE,
  -- The pair is the key, so the same option cannot be ticked twice
  PRIMARY KEY (user_id, option_id)
);

-- Which skills a user ticked. kind says which list the tick is on:
-- 'has' = a skill they have, 'wants' = a skill they are looking for.
CREATE TABLE IF NOT EXISTS user_skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('has', 'wants')),
  PRIMARY KEY (user_id, skill_id, kind)
);

-- Which interests a user ticked
CREATE TABLE IF NOT EXISTS user_interests (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id INTEGER NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, interest_id)
);

-- ---------------------------------------------------------
-- 5. CONNECTION REQUESTS AND MESSAGES
-- ---------------------------------------------------------

-- A request from one user to another. An accepted request is a connection.
CREATE TABLE IF NOT EXISTS connection_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- A user cannot send a request to themselves
  CHECK (sender_id <> receiver_id),
  -- A user cannot send the same person two requests
  UNIQUE (sender_id, receiver_id)
);

-- Messages in the conversation that belongs to an accepted request.
-- Deleting a user deletes their requests, which deletes those conversations.
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES connection_requests(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 6. LOGIN SESSIONS
-- ---------------------------------------------------------

-- One row per browser that has a session. sessionStore.js reads and writes
-- this table. Keeping sessions in the database (not in memory) means users
-- stay logged in when the app restarts or is redeployed.
CREATE TABLE IF NOT EXISTS sessions (
  -- The random session id that is also stored in the browser's cookie
  sid TEXT PRIMARY KEY,
  -- The session's data (for example which user is logged in), saved as JSON text
  data TEXT NOT NULL,
  -- When the session stops being valid, as milliseconds since 1 January 1970
  -- (the same number JavaScript's Date.now() gives)
  expires_at INTEGER NOT NULL
);

-- ---------------------------------------------------------
-- 7. STARTING ROWS
-- ---------------------------------------------------------

-- The five "looking for" options. INSERT OR IGNORE skips a row whose code
-- already exists, so restarting the app does not create duplicates.
INSERT OR IGNORE INTO looking_for_options (code, label) VALUES
  ('cofounder', 'Co-founder / business partner'),
  ('collaborator', 'Project collaborator'),
  ('find_mentor', 'Find a mentor'),
  ('be_mentor', 'Be a mentor'),
  ('social', 'Meet people socially');

-- The two bootcamp courses, added only when the courses table is empty.
-- (Admins can rename courses, so we must not add these again on every start.)
INSERT INTO courses (name)
SELECT name
FROM (
  SELECT 'Software development' AS name
  UNION ALL
  SELECT 'Business development'
)
WHERE NOT EXISTS (SELECT 1 FROM courses);
