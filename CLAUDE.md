# CLAUDE.md

## About me

- I work in a university / academic setting (City, University of London).
- I am a beginner developer. Assume I am still learning the fundamentals.
- My projects are for myself, coursework and my portfolio. There are no clients, deadlines from stakeholders, or production users.
- I build REST APIs and backends, full-stack web apps, data / analytics work, and coursework prototypes.

## Preferred tech stack

- JavaScript on Node.js (CommonJS, Express) for backends.
- Python for scripting and data / analytics work.
- SQL databases with hand-written SQL (SQLite in this project).
- Do not introduce TypeScript, an ORM, or a new framework unless I ask. If you think one would help, explain why and let me decide.

## How to work with me

- **Plan first.** Before writing code, give me a short plan of the steps and wait for me to agree.
- **Small steps.** Make one small change at a time and check it works before moving on.
- **Teach as you go.** Explain what each change does and why. Define any new term the first time you use it, and point out the general concept so I can reuse it.
- **Write tests.** Add tests alongside new features and show me how to run them.
- **Commit often.** After each working step, suggest a small commit with a clear message. Ask before committing or pushing.

## Code style

- Comment heavily: most blocks should have a comment saying what they do and why, so I can study the code later.
- Prefer simple, readable code over clever or compact code.
- Follow the style already in the file (single quotes, semicolons, 2-space indentation, numbered section comments for routes).

## This project

Bootcamp Connect: an Express 5 web app with server-rendered EJS pages and a SQLite
database (`better-sqlite3`). `PRD.md` says what is in scope and `roadmap.md` lists
the features in build order. Read both before feature work.

- `index.js` only starts the server.
- `app.js` builds the Express app (middleware and routes) without starting it, so tests can load it.
- `db.js` opens the database, switches on foreign keys, and runs `schema.sql` at startup.
- `schema.sql` holds every table. Add new tables there with `CREATE TABLE IF NOT EXISTS`.
- `routes/` has one file per feature, plugged in from `app.js`.
- `views/` has the EJS pages. Every page includes `partials/header` and `partials/footer`.
- `public/style.css` is the one stylesheet. Colours are CSS variables, with a dark mode block.
- `tests/` has one `*.test.js` file per feature. Each starts with `require('./helpers')`, which uses an in-memory database.
- `app.db` is the local SQLite database file, created automatically on first run and ignored by Git. `DB_PATH` overrides its location (on Railway it points into the volume).
- Always use prepared statements with `?` placeholders for SQL, never string concatenation.

### Commands

- `npm install` installs dependencies.
- `npm run dev` starts the server with nodemon (restarts on file changes).
- `npm start` starts the server with plain node.
- The server listens on `http://localhost:3000` unless `PORT` is set.
- `npm test` runs all the tests with Node's built-in test runner.
- `docker build -t bootcamp-connect .` builds the image that Railway runs.
