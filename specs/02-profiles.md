# Spec 02: Profiles

**Owner:** Koulla
**Status:** plan agreed by Koulla on 13 October 2026. Walied's answers about
feature 01 were added on 14 October 2026. Feature 01 is merged, so the profile
forms are being built (branch `02-profile-forms`).
See `PRD.md` section 4.2 and `roadmap.md` feature 02.

A spec says how one feature should behave and how we will check it.

## Part 1: Seed script (done)

- `npm run seed` fills the categories, skills and interests lists and adds 8 made-up
  students, four on each course. Safe to run more than once.
- Code: `scripts/seed.js`. Tests: `tests/seed.test.js`. Pull request #2.
- Still to do after 01 is merged: swap the placeholder password for a real hash of a
  shared demo password (there is a `TODO` in the file).
- Still to agree with Walied: how the seed is run on Railway.

## Part 2: Profile forms (being built)

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
| Normal | A valid form saves, marks setup as finished and sends the user to `/` |
| Normal | Two or more "looking for" ticks are all saved |
| Normal | A profile page shows the name and the ticks, and not the email |
| Bad input | A missing required tick is refused with a clear message, nothing is saved, and the other ticks stay ticked |
| Bad input | A bio or business idea of 501 characters is refused |
| Bad input | A skill, interest or "looking for" number that is not in the lists is refused |
| No permission | A logged-out visitor is sent to the login page |
| No permission | A new user who opens another page is sent to the form |
| No permission | A new user who has not finished setup can still open the privacy notice and log out |
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

- New: `routes/profile.js`, `middleware/setup.js` (the gate),
  `views/profile.ejs`, `views/profile-form.ejs`, `tests/profile.test.js`.
- Small changes: `app.js`, `public/style.css`.
- No new library.

### Decisions (Koulla, 13 October 2026)

- The bio is limited to 500 characters, the same as the business idea.
- An unfinished profile shows "Profile not found" to other users.
- One form is used for both setup and editing.

### Agreed with Walied (14 October 2026)

- The login middleware puts the logged-in user's row in
  `res.locals.currentUser`. The login check is called `requireLogin` and lives in
  `middleware/auth.js`.
- `app.js` reads submitted form fields with
  `express.urlencoded({ extended: false })`. A checkbox field can arrive as one
  string or as an array, so the route must always turn it into an array.
- Walied adds `tests/loginHelper.js` in his feature 01 pull request (#3). Tests
  call `loginAs(app, { setupComplete: true })` (or `false` for a new user). It
  returns a Supertest agent that keeps the login cookie, like a browser does.
- Koulla owns the setup gate. It will live in `middleware/setup.js`. In `app.js`,
  Walied will leave a marked place after `requireLogin`; Koulla will add only her
  own lines there. The gate must allow the privacy page and public files through.
- In `public/style.css`, each person adds new rules at the bottom under a
  clearly named heading. Walied owns `views/partials/header.ejs`; Koulla will tell
  him which profile links the header needs.
- After a successful setup, send the student to `/`. This is the home page and
  will become the dashboard when Feature 03 is added.

### Links for Walied's header (Koulla, 14 October 2026)

- One link only: **"My profile"**, pointing to `/profile/<id>` of the logged-in
  user. Show it only when someone is logged in.
- No "Edit profile" link in the header. The profile page already has an
  "Edit my profile" link on the user's own page.

### Feature 01 is merged

Checked on 14 October 2026: Walied's feature 01 (pull request #3) and the
dashboard (feature 03) are merged into `main` and are in this app folder. All
65 tests pass. The agreed pieces are there: `requireLogin` and
`loadCurrentUser` in `middleware/auth.js`, the form reader in `app.js`,
`tests/loginHelper.js`, and the marked place for Koulla's lines in `app.js`.
`currentUser` includes `setup_complete`, which the gate can use. Walied has also
added the "My profile" header link, and the dashboard links each match to
`/profile/<id>`.

The privacy page, login and logout are plugged in **before** `requireLogin`, and
the public files before that, so a gate placed after `requireLogin` lets them
through on its own. The test above still checks this.

### Choices for the profile page (Koulla, 14 October 2026)

- "Profile not found" is sent with the code 404, the web's standard
  "not found" code. This includes an address that is not a number, such as
  `/profile/abc`.
- The initials are the first letter of the first and last names
  ("Sam Taylor" gives ST, "Cher" gives C).
- The ticks are shown as simple lists, with skills grouped under their
  category. Styling comes in build step 5.
- ~~A user can see their own unfinished profile.~~ Changed by Koulla on
  14 October 2026 (build step 4): the gate sends a user who has not finished
  setup to the form from **every** page except the form itself, including
  their own profile page. Their profile would be empty anyway, and one simple
  rule is easier to explain and test.

### The setup gate (Koulla, 14 October 2026)

- `requireSetup` in `middleware/setup.js`, switched on in `app.js` directly
  after `requireLogin` and above the profile routes.
- A user who has not finished setup can open only `/profile/edit` (to see and
  save the form). Every other logged-in page sends them there.
- The privacy notice, login, logout and the files in `public/` sit above
  `requireLogin`, so the gate never sees them and they stay open.
- Walied's dashboard tests (`tests/home.test.js`, 6 tests) and one header
  test (`tests/guard.test.js`) now log in with `setupComplete: true`, because
  their users must get past the gate. Only those `loginAs(...)` lines changed;
  Walied to confirm in the pull request.

### Open questions

- **Should admins skip the setup gate?** Right now the gate covers everyone,
  admins too. Decide when the admin screens (feature 05) are built.
