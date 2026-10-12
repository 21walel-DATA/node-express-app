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

A small Express 5 REST API with a SQLite database (`better-sqlite3`).

- `index.js` holds everything: server setup, database initialisation, and the CRUD routes for the `users` table under `/api/users`.
- `app.db` is the SQLite database file, created automatically on first run.
- Always use prepared statements with `?` placeholders for SQL, never string concatenation.

### Commands

- `npm install` installs dependencies.
- `npm run dev` starts the server with nodemon (restarts on file changes).
- `npm start` starts the server with plain node.
- The server listens on `http://localhost:3000` unless `PORT` is set.
- There is no test setup yet.
