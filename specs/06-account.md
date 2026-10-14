# Spec 06: Account page

**Owner:** Koulla
**Status:** plan agreed by Koulla on 14 October 2026 (evening, after the
feature freeze; Koulla and Walied chose to build it tonight). **Built** on
14 October 2026 (branch `06-account`): all five build steps done, all tests
pass, and every action was tried on the running app with a demo database
(rename, refused email change, password change, refused and real delete).
Koulla checked the page by eye (light and dark mode, phone width,
keyboard). Merged by Walied in pull request #12, and **checked on the
live site** the same evening (see "Checked on the live site" below). Still
waiting for Walied's "Account" header link.
See `PRD.md` sections 4.1 and 4.6, and `roadmap.md` feature 06.

A spec says how one feature should behave and how we will check it.

## The idea

The Account page is the settings drawer for your account:

- **Part A (a brief essential):** change your name, email and password.
- **Part B (an optional extra):** delete your account, confirmed with your
  password.

## The page

| Page | Address | What it does |
|---|---|---|
| Account | `/account` | Three forms: your details, change password, delete my account |
| Goodbye | (shown after deleting) | "Your account has been deleted." with a link to the home page |

The address has no id in it. Every form always acts on the logged-in user,
so there is no way to change or delete someone else's account.

| Form | Address | Fields |
|---|---|---|
| Your details | `POST /account/details` | Name, Email, Current password (only needed when the email changes) |
| Change password | `POST /account/password` | Current password, New password, New password again |
| Delete my account | `POST /account/delete` | Password |

Each form saves and comes back to `/account` (Post/Redirect/Get) with a short
"saved" message, or shows the page again with clear messages if refused.
Passwords are never put back into the page.

How to get there: an "Account settings" link on your own profile page.
An "Account" link in the header is Walied's file, so Walied adds it.

## Rules

- Name: 1 to 100 characters. Email: a valid address, at most 254
  characters, not used by **another** account. Password: 8 to 72
  characters. These are the same rules as registration (`routes/auth.js`);
  they are copied into `routes/account.js` with a comment, to avoid editing
  Walied's file tonight.
- Changing the **email** needs the current password (decision 1).
- Changing the password needs the current password, and the new one typed
  twice the same (decision 2). The user stays logged in.
- Deleting needs the password. It uses Walied's shared `deleteUser`
  (`accounts.js`), which removes the account, profile, requests,
  conversations and photo. Then the user is logged out and sees the goodbye
  page (decision 3).
- The setup gate still covers the Account page (decision 4).

## Acceptance criteria (each one becomes a test, written first)

| Kind | Check |
|---|---|
| Normal | The Account page shows the user's name and email |
| Normal | Changing the name saves it (no password needed) |
| Normal | Changing the email with the right current password saves it, and the new email works at the next login |
| Normal | Changing the password with the right current password works at the next login, and the old one no longer works |
| Normal | Deleting with the right password removes the account, logs the user out and shows the goodbye page; they cannot log in again |
| Bad input | An empty or too-long name, or a badly written email, is refused with a clear message |
| Bad input | An email already used by another account is refused |
| Bad input | Changing the email with a wrong or missing current password is refused, and nothing changes |
| Bad input | A wrong current password, a new password that is too short or too long, or two new passwords that differ, is refused, and the old password still works |
| Bad input | Deleting with a wrong password deletes nothing |
| No permission | A logged-out visitor is sent to the login page, for every address |
| No permission | A user who has not finished setup is sent to the profile form |
| No permission | Any id sent in a form is ignored: only the logged-in user's account changes |
| No results | (not needed: there is always a logged-in user to show) |

## Build order

One small step at a time, test first, one commit each. Part A first, so
that if time runs out, Part B can be cut (roadmap cut order, item 2).

1. Show the Account page, and the "Account settings" link on your own
   profile.
2. Save name and email.
3. Change password.
4. Delete my account (Part B).
5. Styles, then mark the feature done.

## Files

- New: `routes/account.js`, `views/account.ejs`, `views/account-deleted.ejs`,
  `tests/account.test.js`.
- Small changes: `app.js` (Koulla's marked place), `views/profile.ejs`
  (the link), `public/style.css` (only if needed), `roadmap.md`.
- No database changes. No new library (`bcryptjs` is already used for
  passwords).

## Decisions (Koulla, 14 October 2026)

1. Changing the **email** needs the current password; changing the name
   does not.
2. The new password is typed **twice**.
3. After deleting, a short **goodbye page**.
4. The **setup gate** still covers the Account page.

## Asked of Walied

- An "Account" link in `views/partials/header.ejs`, to `/account`, shown
  only when someone is logged in.

## Progress

1. Show the Account page, and the link on your own profile. **Done**
   (`tests/account.test.js`). The page reads the email from the database
   itself, because `currentUser` leaves it out on purpose.
2. Save name and email. **Done.** After saving: "Your details have been
   saved." The current password is only checked when the email really
   changes (capital letters do not count as a change).
3. Change password. **Done.** After saving: "Your password has been
   changed." The user stays logged in. **Part A is complete.** Other
   browsers where the user is logged in stay logged in too; logging those
   out is not in this sprint.
4. Delete my account. **Done. Part B is complete.** A wrong or missing
   password: "Your password is incorrect. Your account has not been
   deleted." The right one uses `deleteUser`, logs the user out (the same
   way as Log out) and shows the goodbye page straight away, because it
   sits behind the login check.
5. Styles. **Done:** section 11 at the bottom of `public/style.css`, one
   rule: the red `button-danger` for "Delete my account". A test checks
   its text passes the 4.5 contrast rule in light and dark mode.

## Checked on the live site

Reported by Koulla on the evening of 14 October 2026, at
https://node-express-app-production.up.railway.app (Railway deployment of
`7ad2a6a`, the merge of pull request #12). The test accounts Test Alpha (A),
Test Bravo (B) and Test Charlie (C) were used, in separate browser windows.
B was connected to A, so check 13 could show what deleting removes.

**Result: all 15 checks passed.**

| # | Who | Check | Result |
|---|---|---|---|
| 1 | A | My profile, then Account settings: name and email filled in | Passed |
| 2 | A | Change the name only: "Your details have been saved.", new name in the header | Passed |
| 3 | A | Change the email with no password: "To change your email, enter your current password." | Passed |
| 4 | A | Change the email with the password: saved | Passed |
| 5 | A | Log out, log in with the new email: works | Passed |
| 6 | A | Wrong current password: "Your current password is incorrect." | Passed |
| 7 | A | Two different new passwords: "The two new passwords do not match." | Passed |
| 8 | A | Change the password properly: "Your password has been changed.", still logged in | Passed |
| 9 | A | Log out: the old password is refused, the new one works | Passed |
| 10 | B | Delete with a wrong password: refused, nothing deleted, still logged in | Passed |
| 11 | B | Delete with the right password: goodbye page, header shows Log in / Register | Passed |
| 12 | B | Log in again: refused | Passed |
| 13 | A | B is gone from Connections; the old conversation shows "misdirected"; B's profile shows "Profile not found" | Passed |
| 14 | Anyone | Dark mode and phone width: the red Delete button is readable, nothing runs off the side | Passed |
| 15 | C, A | Delete C, then A: goodbye page each time | Passed |

Not tried in the browser: sending someone else's id in a form, and the
exact 8 and 72 character password limits. The automated tests cover these.

Check 15 also tidied the live site: all three test accounts from the
feature 04 check are now deleted.

## Open questions

- None yet.
