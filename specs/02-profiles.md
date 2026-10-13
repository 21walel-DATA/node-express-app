# Spec 02: Profiles

**Owner:** Koulla
**Status:** plan agreed by Koulla on 13 October 2026. Waiting for feature 01
(registration and login) to be merged before the forms are built.
See `PRD.md` section 4.2 and `roadmap.md` feature 02.

A spec says how one feature should behave and how we will check it.

## Part 1: Seed script (done)

- `npm run seed` fills the categories, skills and interests lists and adds 8 made-up
  students, four on each course. Safe to run more than once.
- Code: `scripts/seed.js`. Tests: `tests/seed.test.js`. Pull request #2.
- Still to do after 01 is merged: swap the placeholder password for a real hash of a
  shared demo password (there is a `TODO` in the file).
- Still to agree with Walied: how the seed is run on Railway.

## Part 2: Profile forms (not started)

### Pages

| Page | Address | What it does |
|---|---|---|
| Profile form | `/profile/edit` | One form, used for first-time setup and for editing later |
| Profile page | `/profile/:id` | Shows one person's profile. `:id` is the person's id number |

Plus a **gate**: a logged-in user who has not finished setup is sent to the profile
form whenever they open any other page.

### The form

- **Looking for:** five tick boxes. At least one.
- **Skills I have:** tick boxes grouped under category headings. At least one.
- **Skills I am looking for:** the same grouped list. At least one.
- **Interests:** tick boxes. At least one.
- **Bio:** optional, up to 500 characters.
- **Business idea:** optional, up to 500 characters.
- Every field has a visible label and can be used with the keyboard alone
  (PRD section 7).
- The form's address has no id in it. It always saves to the logged-in user, so there
  is no way to open someone else's form.
- When the form is refused, it is shown again with a clear message and the user's
  ticks and text still in place.
- A valid save stores the ticks and text and marks setup as finished.

### The profile page

- Shows the name, course, a coloured circle with the person's initials, bio, business
  idea and all the ticks.
- Never shows the email.
- Shows an "Edit my profile" link only on the user's own page.
- A profile whose owner has not finished setup shows "Profile not found" to others.
- No photo here. Photo upload is feature 07 (Walied).

### Acceptance criteria (each one becomes a test, written first)

| Kind | Check |
|---|---|
| Normal | A valid form saves, marks setup as finished and shows the user's profile |
| Normal | Two or more "looking for" ticks are all saved |
| Normal | A profile page shows the name and the ticks, and not the email |
| Bad input | A missing required tick is refused with a clear message, nothing is saved, and the other ticks stay ticked |
| Bad input | A bio or business idea of 501 characters is refused |
| Bad input | A skill, interest or "looking for" number that is not in the lists is refused |
| No permission | A logged-out visitor is sent to the login page |
| No permission | A new user who opens another page is sent to the form |
| No permission | A user cannot change someone else's profile |
| No results | A profile number that does not exist shows "Profile not found" |

### Build order

One small step at a time, test first for each.

1. Profile page (can be checked with the made-up students).
2. Show the form with the lists from the database.
3. Save the form, with the "at least one" rules.
4. The gate.
5. Styles for the form and the initials circle.

### Files

- New: `routes/profile.js`, `views/profile.ejs`, `views/profile-form.ejs`,
  `tests/profile.test.js`.
- Small changes: `app.js`, `public/style.css`.
- No new library.

### Decisions (Koulla, 13 October 2026)

- The bio is limited to 500 characters, the same as the business idea.
- An unfinished profile shows "Profile not found" to other users.
- One form is used for both setup and editing.

### Open questions for Walied (they depend on feature 01)

1. How does a page know who is logged in, and what is the "must be logged in" check
   called?
2. Is reading of form posts (`express.urlencoded`) switched on in `app.js`?
3. Is there a test helper that logs a made-up user in?
4. Who builds the gate? It sits next to the login check, and both of us would be
   editing `app.js` and `public/style.css`.
5. What is the dashboard's address? Until feature 03 exists, the suggestion is to send
   the user to their own profile page after saving.
