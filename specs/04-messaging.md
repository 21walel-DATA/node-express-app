# Spec 04: Messaging

**Owner:** Koulla
**Status:** plan agreed by Koulla on 14 October 2026, after the 15:00 feature
freeze (messaging is one of the five brief essentials, so it is never cut).
Not built yet.
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
  `views/conversation.ejs`, `tests/connections.test.js`,
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

## Asked of Walied

- A marked place in `app.js` for the connections routes.
- A "Connections" link in `views/partials/header.ejs`, to `/connections`,
  shown only when someone is logged in.

## Open questions

- **If you declined someone, can you later send them a request yourself?**
  Decide at build step 1.
- **How the message time is shown.** The database stores UTC time (the same
  as UK winter time), so until the clocks go back on 25 October it is one
  hour behind UK clocks. Decide at build step 4.
