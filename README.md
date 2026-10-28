# Bootcamp Connect

**A place for ideas to meet action.** Bootcamp Connect helps students on the
software development and business development courses of a bootcamp find each
other as co-founders, project collaborators, mentors or friends.

**Live site:** https://node-express-app-production.up.railway.app

![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/tests-260%20passing-brightgreen)
![Deployed on Railway](https://img.shields.io/badge/deployed%20on-Railway-0B0D0E?logo=railway&logoColor=white)

Built in a 48-hour sprint (12 to 14 October 2026) at the **TechNative Digital
bootcamp** by [Walied Ahmed](https://github.com/21walel-DATA) and
[Koulla](https://github.com/Koullashaker).

---

## Contents

- [The problem](#the-problem)
- [Features](#features)
- [How matching works](#how-matching-works)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Running the tests](#running-the-tests)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Security](#security)
- [How we worked](#how-we-worked)
- [Roadmap](#roadmap)
- [Authors](#authors)

## The problem

The two cohorts learn side by side, but they have no simple way to see who has
the skills they need or who wants the same kind of collaboration. Bootcamp
Connect gives each student a profile and suggests the best matches from either
course, with a plain-English reason for each one.

## Features

| | Feature | What it does |
|---|---|---|
| 01 | **Registration and login** | Sign up with name, email, password and course. You must agree to a privacy notice. Passwords are hashed with bcrypt. |
| 02 | **Profiles** | A setup step asks what you are looking for, which skills you have, which skills you want and your interests. You can add a bio, a business idea (up to 500 characters) and a photo. |
| 03 | **Matching** | The dashboard shows your top 5 matches from either course, each with the reasons for the match. |
| 04 | **Connections and messaging** | Send a connection request from a profile, then accept or decline it. Accepted connections get a private conversation. |
| 05 | **Admin** | Organisers add and remove courses, categories, skills and interests, and can view or remove users. The first admin is created by a script, never through the website. |
| 06 | **Account page** | Change your name, email or password, or delete your account (you confirm with your password). |
| 07 | **Photo upload** | Upload a JPEG profile photo (2 MB at most). Without a photo, the profile shows a coloured circle with your initials. |

The site has a light and dark mode that follows your device setting.

## How matching works

Each time the dashboard loads, every other student who has finished setup gets
a score:

| Rule | Points |
|---|---|
| They have a skill you are looking for | 3 for each skill |
| You are looking for the same thing (both want a co-founder, a collaborator or to meet people socially), or one wants a mentor and the other wants to be one | 2 for each fit |
| You share an interest | 1 for each interest |

The five highest scores are shown, each with its reasons, for example
*"Has a skill you are looking for: Sales"*. Students who score 0 are left out.
If nobody qualifies, the page says "No matches yet". It never invents a match.
The scoring is in [`matching.js`](matching.js).

## Tech stack

| Part | Choice |
|---|---|
| Runtime | Node.js 24 (CommonJS) |
| Web framework | Express 5 |
| Pages | Server-rendered EJS templates, one stylesheet with CSS variables |
| Database | SQLite through `better-sqlite3`, with hand-written SQL and prepared statements (no ORM) |
| Sessions | `express-session`, with sessions stored in SQLite |
| Passwords | `bcryptjs` |
| File uploads | `multer` |
| Tests | Node's built-in test runner and `supertest` |
| Hosting | Docker on Railway, with a volume for the database and photos |

## Getting started

You need [Node.js](https://nodejs.org/) 24 or later and Git.

```bash
# 1. Get the code
git clone https://github.com/21walel-DATA/node-express-app.git
cd node-express-app

# 2. Install the dependencies
npm install

# 3. (Optional) Add the made-up students so there is someone to match with
npm run seed

# 4. Start the server. It restarts when you change a file.
npm run dev
```

Then open http://localhost:3000.

The database file `app.db` is created on first run, and the tables come from
[`schema.sql`](schema.sql).

**Create an admin account.** Set the three `ADMIN_` variables (see below), then run:

```bash
npm run create-admin
```

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server with nodemon and loads a local `.env` file if one exists |
| `npm start` | Starts the server with plain Node (used on Railway) |
| `npm test` | Runs all the tests |
| `npm run seed` | Adds the starter lists and eight made-up students |
| `npm run create-admin` | Creates the first admin from the `ADMIN_` variables |

## Environment variables

You can put these in a `.env` file in the project folder. Git ignores this
file, so it is never committed.

| Variable | Needed? | What it is for |
|---|---|---|
| `PORT` | No | The port to listen on. Default: `3000`. |
| `DB_PATH` | On the live site | Where the SQLite file is saved. Default: `app.db`. On Railway it points into the volume (`/data/app.db`). |
| `SESSION_SECRET` | On the live site | A long random string that signs the login cookie. |
| `PHOTO_DIR` | No | Where photos are saved. Default: a `photos` folder next to the database. |
| `SEED_PASSWORD` | No | The password the seed script gives the made-up students, so you can log in as them. |
| `SEED_DEMO_DATA` | No | Set it to `true` to add the made-up students when the server starts. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Only to create an admin | Read by `npm run create-admin`. |

## Running the tests

```bash
npm test
```

There are 260 tests in [`tests/`](tests), one file for each feature. Every
test runs against a fresh in-memory database, so your real `app.db` is never
touched. They check the rules on each page, such as who can see what and which
form values are refused. They also check the security around photo uploads.

## Project structure

```text
.
├── index.js          Starts the server (the only file that does)
├── app.js            Builds the Express app: middleware and routes
├── db.js             Opens the database, turns on foreign keys, runs schema.sql
├── schema.sql        Every table, as CREATE TABLE IF NOT EXISTS
├── matching.js       The matching score and reasons
├── accounts.js       Shared deleteUser, used by the admin and account pages
├── photos.js         Saving, checking and deleting photo files
├── sessionStore.js   Keeps login sessions in SQLite
├── middleware/       requireLogin, requireAdmin and the setup check
├── routes/           One file per feature
├── views/            EJS pages, plus a shared header and footer
├── public/           style.css, with light and dark colours
├── scripts/          seed.js and create-admin.js
├── tests/            One *.test.js file per feature
├── PRD.md            What the app does and what is out of scope
├── roadmap.md        The features in build order, and the final live check
└── Dockerfile        The image Railway builds and runs
```

`app.js` builds the app without starting it, so the tests can load it
without opening a port.

## Deployment

The live site runs on [Railway](https://railway.app):

1. Every push to `main` makes Railway build the [`Dockerfile`](Dockerfile) and deploy it.
2. A Railway **volume** is mounted at `/data`. `DB_PATH=/data/app.db` keeps
   the database there, and photos go to `/data/photos`.
3. We checked that accounts, messages and photos are still there after a redeploy.

To build the same image on your own computer:

```bash
docker build -t bootcamp-connect .
```

## Security

- Passwords are hashed with bcrypt and never stored as plain text.
- Every SQL query uses prepared statements with `?` placeholders, which
  protects against SQL injection.
- Login cookies are `httpOnly` and `sameSite`, and signed with a secret from
  the environment.
- Every page checks who is allowed to see or change it. A student cannot edit
  another profile, read someone else's conversation or open admin pages
  (they get `403 Forbidden`).
- Photo uploads accept JPEG only, up to 2 MB. The server checks the file's
  first bytes instead of trusting its name, and it chooses the saved file name
  itself. Photos are only shown to logged-in users.
- Deleting an account also deletes its profile, connections, messages and photo.
- Email addresses are never shown on profiles.

## How we worked

- **Plan first:** a [PRD](PRD.md) (product requirements document) and a
  [roadmap](roadmap.md) with a "finish line" checklist for every feature.
- **Small steps:** one branch and one pull request per feature. Each pull
  request was reviewed and merged by the other partner.
- **Tests with every change**, and a manual check on the live site before a
  feature was ticked off.
- **Scope control:** when time ran short, we followed an agreed cut list.
  We simplified features but never cut the brief's essentials.
- **AI-assisted:** we used Claude Code as a pair programmer, in planned and
  reviewed steps. Each of us can explain the code in our own pull requests.

## Roadmap

Done: features 00 to 07. All 23 checks in the final live check passed.

Next ideas (see [`roadmap.md`](roadmap.md)):

- [ ] Block a user
- [ ] Search with filters (course, skills, interests, "looking for")
- [ ] Download a copy of your own data
- [ ] Save your light or dark mode choice to your account
- [ ] Events, favourites and reporting a user

## Authors

| | Built |
|---|---|
| **Walied Ahmed** ([@21walel-DATA](https://github.com/21walel-DATA)) | Foundations, registration and login, matching, admin, photo upload |
| **Koulla** ([@Koullashaker](https://github.com/Koullashaker)) | Foundations, profiles, messaging, account page, final live check |

Built at the TechNative Digital bootcamp, October 2026.
