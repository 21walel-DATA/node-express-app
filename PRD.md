# PRD: Bootcamp Connect (working title)

**Status:** SPRINT VERSION. Merged with Koulla's PRD (agreed 8 October 2026) on
12 October 2026. Agreed by Walied. Koulla has agreed the points in section 13;
awaiting her read-through of the whole document.
The tutor confirmed on 12 October that the app must cover all five essentials in the
course brief.
**Last updated:** 12 October 2026
**Deadline:** a working, deployed app by the evening of **Wednesday 14 October 2026**
(confirmed by the tutor). Submission is on the morning of Thursday 15 October 2026.

A PRD (Product Requirements Document) says who the app is for, what it does, and what
is in and out of scope. It does not say how the code is written.

---

## 1. The user need

> A place for ideas to meet action. For software development and business development
> students on our bootcamp, we will make it possible to find a person on either course
> whose skills, interests and aims fit theirs, so they can start a business
> partnership, a project or a mentoring relationship together.

**What makes this difficult now:** the two cohorts learn side by side but have no
simple way to see who has the skills they need or who wants the same kind of
collaboration.

## 2. Who it is for

- Students on the two bootcamp courses (software development, business development).
- Bootcamp organisers, who act as admins.

Mentoring is offered as something a student can tick under "looking for" (see
section 3). Mentors are not a separate type of account.

Not for: alumni or the general public (see "Out of scope").

## 3. What a "connection" means

Two students who have both agreed to talk. They can be on the same course or on
different courses.

On their profile each student ticks what they are **looking for**. More than one tick
is allowed:

- **Co-founder / business partner**
- **Project collaborator**
- **Find a mentor**
- **Be a mentor**
- **Meet people socially**

## 4. In scope: the sprint essentials

### 4.1 Registration and login
- Sign up with name, email, password and course.
- A mandatory privacy notice checkbox. The notice covers data safety, how profile
  information is shown to other users, and consent to be contacted. The date of
  agreement is saved.
- Log in, log out.
- An "Account" page where a user changes their name, email and password. A password
  change needs the current password.

### 4.2 Profiles
- **Required setup step before the dashboard:** at least one "looking for" option,
  at least one skill they have, at least one skill they are looking for, at least one
  interest.
- Optional: a short bio.
- Optional: a "business idea" text box (up to 500 characters), shown on the profile.
  Any student can fill it in. It is where a business student can put their brief.
- Optional: a profile photo, with size and file-type limits. When there is no photo,
  the profile shows a coloured circle with the person's initials.
- Skills and interests are ticked from fixed lists. No free typing.
- Users can edit their own profile and view other users' profiles.

### 4.3 Matching
- **Dashboard (home page after login):** shows the user's top 5 matches automatically,
  each with a plain-English reason that is true of both saved profiles.
- **Match pool:** every other student who has finished setup, on either course.
  A user never appears in their own matches.
- **What adds to the score:**
  1. the other person has a skill the user is looking for (3 points for each skill),
  2. a "looking for" fit (2 points for each fit). A fit is when both people ticked
     "Co-founder", or both ticked "Project collaborator", or both ticked "Meet people
     socially", or one ticked "Find a mentor" and the other ticked "Be a mentor",
  3. shared interests (1 point for each interest).
- Matches are calculated each time the dashboard loads, so they are always current.
- If nobody qualifies, show "No matches yet". Never invent a person or a reason.

### 4.4 Connection requests and messaging
- A user sends a connection request from a profile. The other person accepts or declines.
- A private conversation opens only after the request is accepted.
- Messages appear when the page is loaded or refreshed (no real-time chat).

### 4.5 Admin screens
- Add, rename and remove courses, categories, skills and interests.
- A category groups skills (for example "Design" or "Marketing"). Each skill belongs
  to one category, and the profile form shows skills under their category.
- View users and remove an account. This uses the same deletion code as section 4.6.
- The five "looking for" options are fixed in the database setup.
- The first admin is created by a setup script run by us, never through the website.

### 4.6 Account deletion
- The Account page has a "Delete my account" button.
- The user must type their password to confirm.
- Deleting removes the account, the profile, their photo file, their skills and
  interests, their connection requests and their conversations. The user is logged out.
- This is account deletion only. We do not claim full GDPR compliance, which also
  covers things such as data export.

### 4.7 Basic blocking (only if 4.1 to 4.6 are deployed in time)

Blocking is an optional extra in the course brief, so it comes after everything above.

- A "Block" button on another user's profile.
- After a block, neither person appears in the other's matches, and neither can send
  the other a request or a message.
- The Account page lists blocked users, each with an "Unblock" button.

## 5. Post-launch extras (not built in this sprint)

In the order we would build them:

1. **Manual search:** a page with filters for course, skills, interests and
   "looking for".
2. **Data export:** a student downloads a copy of the information held on them.
3. **Light/dark toggle** saved to the account.
4. **Events and speakers board:** admins post events, users RSVP, users invite others.
5. **Favourites.**
6. **Report a user**, with an admin moderation queue.
7. Notifications, privacy settings, project ideas board, admin statistics.

## 6. Out of scope

| Item | Why |
|---|---|
| Swipe ("Tinder-style") interface | We chose a dashboard instead. |
| Mentors as a separate user type | Adds a third case to every feature. Mentoring is a "looking for" option instead. |
| Sign-up open to the public | Needs much stronger moderation. |
| Payments, ads, subscriptions | Not in the brief. See section 10. |
| Real-time chat | Stretch goal. |
| AI matching or icebreakers | Stretch goal. |
| Mobile-friendly design | Stretch goal. We do not test at phone width in this sprint. |

## 7. Look, feel and accessibility

Goal: clean and minimalist, readable for all ages and sight levels. Checkable rules:

- One shared page layout and one stylesheet, so every page looks the same.
- Text contrast of at least 4.5:1 in both light and dark mode (WCAG AA).
- Body text no smaller than 16px.
- Every form field has a visible label.
- Every page can be used with the keyboard alone.
- The device's system font is used.
- Dark mode follows the device setting automatically.

## 8. Access rules (apply to every feature)

- Only the register, login and privacy notice pages can be seen without logging in.
- A user can change or delete only their own account and profile.
- Email addresses are never shown on profiles or on the dashboard.
- Passwords are stored hashed (scrambled). Nobody can read them, not even admins.
- A conversation can be read only by its two participants. Admins cannot read it.
- Admin pages can be opened only by admins.
- A user who has not finished the required setup does not appear in matches.

## 9. Architecture

- Node.js + Express, CommonJS, plain JavaScript. No TypeScript, no ORM.
- SQLite with hand-written SQL and `?` placeholders.
- Server-rendered pages using EJS templates.
- **Host: Railway** (the tutor allowed Railway or Fly.io). Railway deploys from the
  GitHub repo each time we push, and its volume is set up in the dashboard.
- Runs in Docker. The database file and the uploaded photos live in a Railway volume
  so they survive redeploys.
- One shared GitHub repo. One branch and one short pull request per feature. The other
  partner reads it and merges it.
- The demo uses made-up seed profiles, not real classmates' data.

| Choice | Decision | New library |
|---|---|---|
| Page templates | EJS | `ejs` |
| Password storage | Hashed with bcrypt, never stored as plain text | `bcryptjs` |
| Staying logged in | Server-side sessions with a cookie, stored in SQLite | `express-session` + a SQLite session store |
| Tests | Node's built-in test runner, plus a helper for sending test requests | `supertest` (dev only) |
| Photo upload | Saved to the volume, with size and file-type limits | `multer` |
| Code layout | Split `index.js` into `routes/`, `views/`, `public/`, `db.js`, `tests/`, `scripts/` | none |
| Database setup | One `schema.sql` file run at startup; start from a fresh database | none |

**Data to store (tables, in outline):** users, courses, categories, "looking for"
options, skills, interests, user "looking for" ticks, user skills (have / looking
for), user interests, connection requests, messages. Only if 4.7 is reached: blocks.

## 10. Business model (written down, not built)

Ideas from our brainstorm: adverts, a full-access subscription, in-app purchases.
None of these are built in this version. They are recorded here so the idea is not lost.

## 11. What success looks like

- Features 4.1 to 4.6 work at the deployed URL, not only on a laptop.
- Each feature has a short checklist that was checked by hand at the deployed URL:
  the normal case, bad input and denied access.
- Each feature has at least one automated test, and `npm test` passes.
- A seed user from each course sees at least one match with a correct reason.
- Each partner can point to their own pull requests and explain the code in them
  (the course rule: "we are not vibecoding").

## 12. Risks

| Risk | How we reduce it |
|---|---|
| All five brief essentials plus account deletion in two days is very tight | Fixed build order. Cut order if we fall behind: blocking, then account deletion, then the decline button. The five brief essentials are never cut, only simplified. |
| Koulla's laptop is set up (confirmed 12 October), but she has not yet cloned this repo and pushed to it | She does both during feature 00, before taking a feature. |
| Deployment fails late | Deploy a "hello" page on Monday evening. Deploy after every feature. |
| A late change breaks the working app | Feature freeze at 15:00 on Wednesday. After that, fixes only. |
| Existing `/api/users` routes are open to anyone | Removed in feature 00. |
| `app.db` is committed to Git | Removed from Git and ignored in feature 00. |
| Two people editing the same files | Split files in feature 00; one branch per feature. |
| Real personal data arriving before safety features | Seed profiles only. |
| The privacy notice is not legal advice | Keep it plain and honest; ask the tutor to review it. |

## 13. Questions

**Answered**

1. **Host:** Railway. (Tutor allowed Railway or Fly.io.)
2. **Deadline:** the evening of Wednesday 14 October 2026. (Confirmed by the tutor.)
3. **Match pool:** either course, as in Koulla's PRD.
4. **"Looking for":** five options, more than one tick allowed, as in Koulla's PRD.
5. **Match score weights:** 3 / 2 / 1 as in section 4.3; show the top 5.
6. **What the pages are built with, and the testing tool:** EJS, and Node's built-in
   test runner with `supertest`.
7. **Who builds what:** see `roadmap.md`. Koulla has agreed to her features.
8. **Must the sprint version cover all five brief essentials?** Yes (tutor,
   12 October). Photo, change account details, and admin courses and categories are
   back in scope.
9. **"Skills they are looking for"** is a required profile field. (Koulla agreed.)
10. **Deleting an account** also deletes that person's conversations. (Koulla agreed.)

**Still open**

11. **Business students' briefs.** The tutor said the business development students
    are writing briefs. We assume a brief is a short description of a business idea,
    so profiles have an optional "business idea" box (section 4.2). Still to ask the
    tutor: what a brief actually contains, and whether one text box is enough.
12. **"Categories":** the brief does not say what they group. Assumption: they group
    skills. Confirm with the tutor if there is time.
13. **Privacy notice wording:** how long we keep information, and who the contact is.
    (Koulla drafts on Monday; tutor review if possible.)
14. **The two CLAUDE.md files** (one on each laptop) are different. Bring them into
    line after submission.
15. **App name, design and colours.** Does not block anything.

## 14. Approval

| Who | Approved? | Date |
|---|---|---|
| Walied | Yes | 12 October 2026 |
| Koulla | | |
| Tutor | | |
