# Sai Tunes — Studio Manager

Asset register, lending logbook, production tracker, and maintenance scheduler for the
Sai Tunes Hostel Music Department, SSSIHL.

Live: <https://saitunes.koushikv.site> (deployed from `main` via Vercel)

Originally scaffolded in AI Studio: <https://ai.studio/apps/5ef3cf36-0574-406a-be41-ce0c3910d627>

## Run locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev
```

| Command         | What it does                               |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Vite dev server on <http://localhost:3000> |
| `npm run lint`  | `tsc --noEmit` — full strict type check    |
| `npm run build` | Production build into `dist/`              |

## Firebase setup

There is no `.env` for Firebase. Config lives in `firebase-applet-config.json`, which is
committed on purpose: Firebase web keys are public identifiers, and access is enforced by
`firestore.rules` — not by hiding them.

### ⚠️ The database is *not* `(default)`

Data lives in a **named** Firestore database:

```
ai-studio-5ef3cf36-0574-406a-be41-ce0c3910d627
```

This matters constantly:

- `src/lib/firebase.ts` passes the name to `initializeFirestore(app, settings, databaseId)`.
- `firebase.json` maps `firestore.rules` to that database by name. Without this mapping,
  `firebase deploy --only firestore:rules` either fails or writes rules to `(default)`,
  which nothing reads — so the rules silently never take effect.
- In the Firebase Console, pick the named database from the dropdown before editing rules.

Confirm the name any time with:

```bash
firebase firestore:databases:list
```

### Deploying security rules

```bash
firebase deploy --only firestore:rules
```

Rules are in [`firestore.rules`](firestore.rules). Access model:

| Collection          | Read      | Write                                                              |
| ------------------- | --------- | ------------------------------------------------------------------ |
| `allowed_users`     | whitelist | admin only                                                          |
| `assets`            | whitelist | managers; students may change only `lentTo` / `lentAt`              |
| `instrument_logs`   | whitelist | whitelist may create/close; managers may delete                     |
| `projects`          | whitelist | managers create/delete; any student may update stage                |
| `maintenance_tasks` | whitelist | managers create/delete; students may change `lastDone` / `history`  |

"Whitelist" means a document exists at `allowed_users/<lowercase-email>`.
Roles are `admin`, `junior_admin` (manager), and `member` (student).

**Break-glass:** `koushikv@sssihl.edu.in` is hard-coded as master admin in both
`firestore.rules` and `src/App.tsx`, so the owner can always restore access even if every
`allowed_users` document is deleted. Change it in both places if ownership moves.

### Authentication

Google sign-in via `signInWithPopup`. Every domain that serves the app must be listed under
**Firebase Console → Authentication → Settings → Authorized domains**, including:

- `saitunes.koushikv.site`
- `localhost` (for development)
- any Vercel preview domain you sign in from

A missing entry produces `auth/unauthorized-domain`, which the app surfaces along with the
exact hostname to add.

## Deployment

The app is hosted on **Vercel**, which builds from `main` on push. Firebase provides only
Auth and Firestore.

`firebase.json` also retains a `hosting` block pointing at `dist/`. It is unused by the live
site and safe to delete if you never intend to serve from Firebase Hosting.

## Project layout

```
src/
  App.tsx                    auth gate, role resolution, tab shell
  types.ts                   shared domain types
  lib/
    firebase.ts              app/auth/firestore init (named database)
    stages.ts                production stages, asset statuses, role badges
    format.ts                date and name formatting helpers
  components/
    InstrumentLogbook.tsx    inventory + lending
    ProjectsTracker.tsx      production pipeline
    ProjectsPortfolio.tsx    read-only archive by year
    MaintenanceScheduler.tsx routine checks + completion log
    AdminControls.tsx        user whitelist and roles
    ui/                      Modal, Toast, shared primitives
```
