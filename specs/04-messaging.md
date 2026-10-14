# Spec 04: Messaging

**Owner:** Koulla
**Status:** plan agreed by Koulla on 14 October 2026, after the 15:00 feature
freeze (messaging is one of the five brief essentials, so it is never cut).
**Built** on 14 October 2026 (branch `04-messaging`): all six build steps
done, all tests pass, the whole journey was tried on the running app, and
Koulla checked the pages by eye (light and dark mode, phone width, keyboard
only). Merged by Walied in pull request #10, and **checked on the live
site** the same evening (see "Checked on the live site" below). Still
waiting for Walied's "Connections" header link.
See `PRD.md` section 4.4 and `roadmap.md` feature 04.

A spec says how one feature should behave and how we will check it.

## The idea

Like swapping phone numbers at a party:

1. A student sends another student a **connection request**.
2. The other student **accepts** or **declines** it.
3. Only after an accept, the two of them get a **private conversation**.

Messages appear when the page is loaded or refreshed. There is no live chat.

## The database (already there, no changes needed)

Walied's `schema.sql` (section 5) already has both tables:

- `connection_requests`: sender, receiver and status (`pending`, `accepted` or
  `declined`). It already refuses a request to yourself and the same request
  twice (`UNIQUE (sender_id, receiver_id)`).
- `messages`: each message, who sent it, and which request (conversation) it
  belongs to.

Deleting a user already deletes their requests and conversations
(`ON DELETE CASCADE`). No new library.

Note: the database allows A to ask B **and** B to ask A, because those are
different pairs. The route must refuse the second one itself.

## Pages

| Page | Address | What it does |
|---|---|---|
| Profile page (feature 02) | `/profile/:id` | Gets a "Send connection request" button, or a status line instead |
| Connections | `/connections` | Requests to you (Accept / Decline), requests you sent, and your connections |
| Conversation | `/conversations/:id` | The messages, oldest first, and a box to write a new one. `:id` is the accepted request's id |

The buttons send forms (POST), never plain links, because they change data:

| Action | Address |
|---|---|
| Send a request | `POST /connections/request/:userId` |
| Accept a request | `POST /connections/:id/accept` |
| Decline a request | `POST /connections/:id/decline` |
| Send a message | `POST /conversations/:id` |

### What the profile page shows (someone else's finished profile)

| Situation | Shows |
|---|---|
| No request either way | "Send connection request" button |
| You sent one, waiting **or declined** | "Request sent" (decision 2) |
| They sent you one, waiting | "They have sent you a request" and a link to `/connections` |
| They sent you one, and you declined | "You declined their request" (no button: decision 5) |
| Accepted, either way round | "You are connected" and an "Open conversation" link |

On your own profile none of these appear.

### The "not yours" page (decision 4)

Shown with the code 404 for a conversation that is not yours, one that is not
accepted, and one that does not exist, so a snooper cannot tell them apart:

> **Oops, you have been misdirected**
> Apologies, this conversation isn't available.
> [Back to my connections]

## Acceptance criteria (each one becomes a test, written first)

| Kind | Check |
|---|---|
| Normal | A sends B a request. B accepts it. They can now send and read messages |
| Normal | B declines. No conversation opens, and A still sees "Request sent" |
| Normal | Messages show oldest first, with the sender's name and the time |
| Bad input | A request to yourself is refused, and nothing is saved |
| Bad input | A second request to the same person is refused |
| Bad input | A request back to someone who already asked you is refused |
| Bad input | A request to someone who does not exist or has not finished setup shows "Profile not found" (404) |
| Bad input | An empty message, or one over 500 characters, is refused with a clear message, and the text stays in the box |
| No permission | A logged-out visitor is sent to the login page |
| No permission | Only the person who received a request can accept or decline it, and only while it is waiting |
| No permission | You cannot message someone you are not connected to |
| No permission | A third person cannot read or post in a conversation, even by typing its address |
| No permission | There is no admin page that shows conversations |
| No results | No requests and no connections shows "No connections yet" |
| No results | A conversation that does not exist shows the "misdirected" page (404) |

## Build order

One small step at a time, test first, one commit each.

1. Send a request from the profile page.
2. The Connections page, with its three lists.
3. Accept and decline.
4. The conversation page (reading), with the "only the two of you" check.
5. Send a message.
6. Styles, and a "Connections" link in the header (Walied's file, so Walied
   adds it).

## Files

- New: `routes/connections.js`, `views/connections.ejs`,
  `views/conversation.ejs`, `views/conversation-not-found.ejs` (the
  "misdirected" page), `tests/connections.test.js`,
  `tests/messages.test.js`.
- Small changes: `views/profile.ejs` (Koulla's), `public/style.css` (a new
  section at the bottom), `app.js` (a marked place, asked for from Walied),
  `roadmap.md`.

## Decisions (Koulla, 14 October 2026)

1. Build the **full** version (all 6 steps). If it runs late, drop to roadmap
   cut #3 (no decline button, no "sent" list).
2. After a decline, the sender still sees **"Request sent"**. They are never
   told "no", and they cannot send another request.
3. A message can be up to **500 characters**, the same as the bio.
4. A conversation that is not yours shows the **"misdirected" page** with the
   code 404 and a link back to your connections (option a: no automatic jump).
5. **One request per pair, ever.** Once there is any request between two
   people, either way round and whatever its status, neither can send a new
   one. So someone who declined cannot later ask that person themselves.
6. The two `app.js` lines for this feature go inside Koulla's own FEATURE 02
   marked place, just under the profile routes, so the setup gate covers
   them. No need to wait for Walied.
7. Message times are shown in **UK time**, for example "14 Oct 2026, 21:51".
   The database saves UTC, so the page moves it on an hour in British Summer
   Time. This uses JavaScript's built-in date tools, no library.

## Asked of Walied

- ~~A marked place in `app.js`~~: not needed (decision 6).
- A "Connections" link in `views/partials/header.ejs`, to `/connections`,
  shown only when someone is logged in.

## Progress

1. Send a request from the profile page. **Done** (`tests/connections.test.js`).
2. The Connections page, with its three lists. **Done.** If all three are
   empty it says "No connections yet" with a link to the dashboard; an
   empty list on its own says "None right now" (or "None yet").
3. Accept and decline. **Done.** A refused answer (someone else's request,
   one already answered, or one that does not exist) changes nothing and
   sends the user back to `/connections`, the same way step 1 sends them
   back to the profile.
4. The conversation page (reading). **Done** (`tests/messages.test.js`).
   "Open conversation" links are on a connected profile and next to each
   connection. No messages yet shows "No messages yet. Say hello!".
5. Send a message. **Done.** Empty (or only spaces): "Please write a
   message before sending." Over 500 characters: "Your message must be 500
   characters or fewer.", with the text kept in the box. The sender is
   always the logged-in user, whatever the form sends.
6. Styles. **Done:** section 10 at the bottom of `public/style.css`. A test
   checks every class the messaging pages use has a rule there. The
   "Connections" header link is still to be added by Walied.

## Checked on the live site

Reported by Koulla on the evening of 14 October 2026, at
https://node-express-app-production.up.railway.app (Railway deployment of
`a50d503`, the merge of pull request #10). Three new test accounts, Test
Alpha (A), Test Bravo (B) and Test Charlie (C), were registered through the
Register page, each in its own browser window. Check 14 (the admin pages)
was planned for Walied's admin account.

**Result: all 15 checks passed.**

| # | Who | Check | Result |
|---|---|---|---|
| 1 | A | Send B a request from B's profile: "Request sent" | Passed |
| 2 | A | Back button, then press the old button again: B still has only one request | Passed |
| 3 | A | Own profile has no "Send connection request" button | Passed |
| 4 | A | Typing a conversation address before connecting shows the "misdirected" page | Passed |
| 5 | B | `/connections` shows A once under "Requests to you", with Accept and Decline | Passed |
| 6 | B | Accept: A moves to "Your connections" | Passed |
| 7 | A | B's profile says "You are connected. Open conversation" | Passed |
| 8 | A | Send a message: it appears with the right UK time | Passed |
| 9 | B | Refresh: A's message is there; reply | Passed |
| 10 | A | Refresh: B's reply is there | Passed |
| 11 | A | Send with an empty box: "Please write a message before sending." | Passed |
| 12 | C | Opening A and B's conversation address shows the "misdirected" page | Passed |
| 13 | C, A | C asks A, A declines: C still sees "Request sent" | Passed |
| 14 | Walied | No admin page shows conversations | Passed |
| 15 | Anyone | Readable on a phone and in dark mode | Passed |

Not tried in the browser, because they need tools rather than clicks: a
request to yourself sent directly, a fake sender, and a message over 500
characters (the browser stops at 500). The automated tests cover these.

Still to do: Walied removes the three test accounts from the admin pages,
so they do not appear in real students' matches.

## Open questions

- ~~**If you declined someone, can you later send them a request
  yourself?**~~ No (decision 5).
- ~~**How the message time is shown.**~~ In UK time (decision 7).
