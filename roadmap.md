# Roadmap: Bootcamp Connect (working title)

**Status:** 48-HOUR SPRINT. Merged with Koulla's roadmap on 12 October 2026.
See `PRD.md` for scope.
**Last updated:** 12 October 2026
**Deadline:** deployed and working by the evening of Wednesday 14 October 2026.
The tutor confirmed that all five essentials in the course brief must be covered.

## How we work on each feature (sprint version)

1. Take the next feature below. Start a new branch for it.
2. Read its finish line. That is the checklist.
3. Write the code, plus at least one test for the most important rule.
4. Run `npm test`. Check the finish line by hand on your own laptop.
5. Open a short pull request. The other partner reads it and merges it.
6. Railway deploys automatically. Check the finish line again at the deployed URL.
7. Tick the feature in "Progress" at the bottom.

**Rules:**
- Never start a new feature while the deployed site is broken. Fix it first.
- A feature is finished only when whoever built it can explain it.
- Every feature includes its access checks: who is allowed to see or change what.

---

## Features

### 00 Foundations (together, Monday)
Sets the project up so that two people can build features without colliding.
- Koulla clones the repo, runs `npm install` and `npm test`, and pushes one small
  change, to prove her laptop works with this project.
- Remove `app.db` from Git and ignore it.
- Remove the open `/api/users` practice routes.
- Split `index.js` into `routes/`, `views/`, `public/`, `db.js`, `tests/`, `scripts/`.
- Add `schema.sql` with all the tables, run at startup.
- Read the database location from an environment variable, so it can live in a volume.
- Add EJS, one shared page layout and one stylesheet with light/dark colour variables.
- Add the test tool and one passing test.
- Add a Dockerfile.
- Create the Railway project, attach a volume, and deploy a "hello" page.

**Finish line:** `npm test` passes on both laptops; the hello page loads at the
Railway URL in light and dark mode; data is still there after a redeploy.

### 01 Registration and login (Walied)
- Register with name, email, password, course, and the mandatory privacy notice
  checkbox.
- Log in and log out. Pages other than register/login/privacy notice require login.

**Finish line:** a new user can register, log out and log back in. Registering without
agreeing to the privacy notice is refused. A wrong password, or an email already in
use, is refused with a clear message. Passwords in the database are not readable.
A logged-out visitor is sent to the login page.

### 02 Profiles (Koulla)
- Seed script that fills the courses, categories, skills and interests lists and
  creates made-up profiles on both courses.
- Required setup step: "looking for" ticks (co-founder, project collaborator, find a
  mentor, be a mentor, meet people socially), skills they have, skills they are
  looking for, interests.
- Optional bio. Optional "business idea" text box (up to 500 characters).
- Profile page with an initials circle. Edit own profile.

**Finish line:** a new user cannot reach the dashboard until setup is complete. A user
can tick more than one "looking for" option. A user can edit their own profile but
not anyone else's. Email is not shown on profiles.

### 03 Matching (Walied)
- Dashboard lists the top 5 matches from either course, each with a reason.
- Scoring as in PRD section 4.3.

**Finish line:** for a seed user, the matches and reasons agree with the saved
profiles when checked by hand. The user never appears in their own matches. A user
who ticked "Find a mentor" sees a "Be a mentor" user scored as a fit. A user with no
qualifying match sees "No matches yet".

### 04 Messaging (Koulla)
- Send a connection request from a profile. Accept or decline.
- A conversation for each accepted connection. Send and read messages.

**Finish line:** two connected users can exchange messages. A user cannot send a
duplicate request, request themselves, or message someone they are not connected to.
A third user cannot read the conversation, even by typing its address directly.
There is no admin page that shows conversations.

### 05 Admin (Walied)
- Setup script that creates the first admin.
- Admin pages to add, rename and remove courses, categories, skills and interests.
- Admin page to view users and remove an account. Walied writes the shared
  "delete a user" function here; feature 06 reuses it.

**Finish line:** a skill added by an admin appears on the profile form under its
category. A course added by an admin appears on the registration form. A removed user
cannot log in and does not appear in matches. A non-admin who opens an admin page is
refused.

### 06 Account page (Koulla)
- **Part A, change details (brief essential):** change name, email and password.
- **Part B, delete account:** "Delete my account", confirmed by typing the password.
  Uses the shared "delete a user" function from feature 05.

**Finish line, part A:** a password change needs the current password, and the new
one works at next login. A user cannot change anyone else's details.
**Finish line, part B:** after deleting, the user is logged out, cannot log in again,
and no longer appears in anyone's matches or conversations. A wrong password deletes
nothing. A user cannot delete anyone else's account.

### 07 Photo upload (Walied)
- Upload a profile photo, with size and file-type limits, saved to the volume.
- Initials circle shown when there is no photo.

**Finish line:** a photo of an allowed type and size shows on the profile and is
still there after a redeploy. A file that is too large or the wrong type is refused
with a clear message. A user cannot change anyone else's photo. Deleting the account
removes the file.

### 08 Basic blocking (only if 00 to 07 are deployed by 13:00 on Wednesday)
- Block button on a profile. Blocked list with Unblock on the Account page.

**Finish line:** after a block, neither person appears in the other's matches, and
neither can send the other a request or a message.

---

## Timetable

| When | Walied | Koulla |
|---|---|---|
| Mon 12 Oct, now | 00: Git clean-up, split files, EJS layout, test | 00: laptop check, Railway account, Dockerfile, volume; privacy notice text; lists of skills and interests |
| Mon evening | 00: hello page deployed and checked together | |
| Tue 13 Oct, morning | 01 Registration and login | 02 Seed script, then profile forms |
| Tue afternoon | 03 Matching | 02 Profiles finished |
| Tue evening | 05 Admin started. Deploy and check 01 to 03 together | 04 Messaging started |
| Wed 14 Oct, morning | 05 Admin finished, then 07 Photo upload | 04 Messaging finished, then 06 Account page |
| Wed 13:00 | 00 to 07 deployed | |
| Wed 13:00 to 15:00 | 08 Blocking only if everything above is deployed; otherwise finish what is open | |
| Wed 15:00 | **Feature freeze.** Fixes only from here. | |
| Wed evening | Final check of every finish line at the deployed URL | |
| Thu 15 Oct, morning | Submit | |

## If we fall behind, cut in this order

The five brief essentials are never cut, only simplified.

1. 08 Basic blocking.
2. 06 part B, delete account (an optional extra in the brief).
3. Decline button and pending list in 04 (keep send and accept only).
4. Simplify 07: accept one image type only, no resizing.
5. Simplify 05: add and remove only, no rename.

## Post-launch extras (after submission)

| Feature | Finish line |
|---|---|
| Manual search | Filters for course, skills, interests and "looking for" return only matching profiles. |
| Data export | A student can download a copy of the information held on them, and only their own. |
| Light/dark toggle | The choice is saved to the account. |
| Events slice 1 | An admin-created event appears for all users. |
| Events slice 2 | A user can RSVP and cancel; the list shows who is going. |
| Events slice 3 | A user can invite a connection, who sees the invitation. |
| Favourites | A user can save a profile and see their saved list. |
| Report a user | Reports reach an admin moderation queue. |
| Notifications, privacy settings, project ideas board, admin statistics | In the order we choose at the time. |

## Progress

- [x] 00 Foundations
- [x] 01 Registration and login
- [x] 02 Profiles
- [x] 03 Matching
- [x] 04 Messaging
- [x] 05 Admin
- [x] 06 Account page (A: change details, B: delete account)
- [x] 07 Photo upload
- [ ] 08 Basic blocking (if time)

## Final live check (14 October 2026, evening)

Every finish line from 00 to 07, checked at
https://node-express-app-production.up.railway.app with two new test
students, Test Delta (`delta@example.com`, Software development) and Test
Echo (`echo@example.com`, Business development), and Walied's admin account.
"Claude" means the check was done with page requests from Koulla's laptop,
with Koulla's go-ahead; "Koulla" means checked by eye; "Walied" means
reported by Walied.

**Result so far: 19 passed, 4 still open.** The open ones are listed first.

### Still open

| # | Feature | Check | Status |
|---|---|---|---|
| 2 | 00 | Data is still there after a redeploy | **Open.** On the live site, Delta's connection request got number 1, although requests were made there earlier in the evening (the 04 check) and request numbers are never reused. The live database may have been reset or replaced. Asked Walied whether he reset it; no answer yet |
| 20 | All | Header links to Connections (`/connections`) and Account (`/account`) | **Open.** Not on `main` yet (Walied's file, `views/partials/header.ejs`). Both pages can be reached from "My profile" |
| 22 | 05, 06 | An admin removes Echo; Echo cannot log in and is gone from Delta's matches | **Open.** At 23:01 Echo could still log in, and was still in Delta's matches and connections |
| 23 | Tidy-up | Delete Delta and Echo, and the test skill and course | **Open.** Waits for 22 |

### Passed

| # | Feature | Check | Who | Result |
|---|---|---|---|---|
| 1 | 00 | Readable in light and dark mode | Koulla | Passed |
| 3 | 01 | Registering without the privacy tick is refused | Claude | Passed |
| 4 | 01 | Register Delta, log out, log back in | Claude | Passed |
| 5 | 01 | A wrong password is refused with a clear message | Claude | Passed |
| 6 | 01 | Registering `DELTA@example.com` again is refused (capitals do not matter) | Claude | Passed |
| 7 | 01 | A logged-out visitor opening `/connections` is sent to the login page | Claude | Passed |
| 8 | 02 | A new user opening `/`, `/connections` or `/account` is sent to the profile form | Claude | Passed |
| 9 | 02 | Two "looking for" ticks are both saved and shown | Claude, Koulla | Passed |
| 10 | 02 | Someone else's profile shows no email and no Edit link | Claude | Passed |
| 11 | 03 | Register Echo as "Be a mentor" | Claude | Passed |
| 12 | 03 | Delta sees 5 matches with reasons, not herself; Echo is top, with "You are looking for a mentor and they want to be one" | Claude, Koulla | Passed |
| 13 | 04 | Request, accept, and one message each way, with the right UK time | Claude | Passed |
| 14 | 05 | A skill added by the admin appears on the profile form | Walied | Reported passed |
| 15 | 05 | A course added by the admin appears on the Register page | Walied | Reported passed |
| 16 | 05 | A non-admin opening `/admin` is refused (403) | Claude | Passed |
| 17 | 07 | A JPEG under 2 MB shows on the profile | Koulla | Passed |
| 18 | 07 | A PNG, or a file over 2 MB, is refused with a clear message | Koulla | Passed |
| 19 | 06 | Delta changes her name on the Account page | Claude | Passed |
| 21 | All | Usable at phone width and with the keyboard only | Koulla | Passed |

Covered by the automated tests rather than by clicking: photo file tricks,
changing someone else's photo, passwords stored scrambled, "No matches yet",
and someone else's id sent in a form.
