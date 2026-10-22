# SignMeUp — Course Registration System

[![CI](https://github.com/miguelr-dev/Course-Registration/actions/workflows/ci.yml/badge.svg)](https://github.com/miguelr-dev/Course-Registration/actions/workflows/ci.yml)

An integrated set of functions to support a university course registration
process, built for a small university of ~2,000 students. This is the CS 532
team project; the goal for the semester is an initial integrated, functional
prototype.

## Subsystems

| Subsystem | Code | Purpose |
|---|---|---|
| SignMeUp Framework | — | Integration shell: logon, authorized-user management, subsystem menu, password reset |
| Electronic Student Record | ER | Student info, completed/transfer/current courses, append-only notes, GPA reporting |
| Course Registration | REG | Course offerings, schedules, seat tracking, on-line registration, eligibility rules |
| Major Course Requirements | MAJOR | Required courses per major, approved student outlines with change history |
| Faculty and Course Information | FCI | Faculty and course catalog, cross-queries, department reports |
| Course Grades | GRADE | Grade entry by primary instructor, grade notes, course/department/university statistics |

The full requirements are in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
(converted from the original Word document, kept at
[docs/CourseRegReqs.docx](docs/CourseRegReqs.docx)).

## Key constraints from the requirements

- **Single entry of information** — data is entered once and reused everywhere.
- **Validation on entry** — errors must be resolved before more data is accepted,
  with error messages stating the reason and the minimum requirements to pass.
- **Roles and privileges** — object-based security; every transaction is labeled
  with the user's name, date, and time.
- **Append-only records** — student notes and approved major outlines are never
  deleted; modifications keep a history.
- **Relational data model** — one-to-many and many-to-many structures (students
  ↔ courses, majors ↔ courses, faculty ↔ courses).
- **Responsiveness** — committed transactions respond within 5 seconds.
- **Modular design** — subsystems can be added, upgraded, or replaced with
  relative ease.

## Repository layout

```
Course-Registration/
├── README.md                 # you are here
├── docs/
│   ├── REQUIREMENTS.md       # full project requirements (markdown)
│   ├── DESIGN-HANDOFF.md     # UI direction, design canvas link, Claude Design prompt
│   ├── ARCHITECTURE.md       # framework vs. modules; how to add or replace a module
│   └── CourseRegReqs.docx    # original requirements document
├── .env.example              # Clerk publishable key + optional admin list
├── src/
│   ├── data/                 # types, sample data seed, in-browser store
│   ├── lib/                  # registration rules, GPA/statistics, wildcard search, formatting
│   ├── components/           # app shell, help drawer, icons, shared UI
│   ├── modules.ts            # subsystem registry: menu, routes, access area per module
│   ├── screens/              # one file per screen (see below)
│   └── styles/global.css     # design tokens and component styles
├── db/schema.sql             # relational schema for Supabase (normalized tables + document store)
├── vercel.json               # single-page-app rewrite for Vercel
└── .github/workflows/ci.yml  # CI checks, run on every PR and push to main
```

## The prototype

A React + TypeScript single-page app (Vite) with a small API layer of Vercel
serverless functions. The data model is one document seeded with a small sample
university; it is stored in Supabase Postgres and shared by everyone who signs
in (see *Shared database* below). Every screen is functional: registration
rules are enforced, notes and outline history are append-only, grades update
statistics live, and every transaction is labeled with the user's name, date
and time.

| Screen | Route | Who |
|---|---|---|
| Sign in / create account (Clerk, @sdsu.edu only) | `/login`, `/sign-up` | everyone |
| Student dashboard (schedule, eligible major courses) | `/` | students |
| Course search & registration | `/search` | students |
| Electronic student record + append-only notes | `/record` | students (own), advisors, registrar |
| Approved major outline + change history | `/outline` | students (own), advisors |
| Faculty & course information | `/faculty` | everyone with FCI access |
| Grade sheet + course statistics | `/grades` | primary instructor, registrar |
| Authorized users + access areas | `/users` | system administrators |

### Authentication (Clerk)

Sign-in and sign-up are handled by [Clerk](https://clerk.com); SignMeUp never
stores a password. Anyone with an **@sdsu.edu** address can create an
account and sign in. Two layers enforce that:

1. The Clerk instance's **allowlist** contains `*@sdsu.edu` and is enforced on
   both sign-up and sign-in, so other domains are refused before an account
   exists.
2. The app checks the domain again on every session (`src/lib/auth.ts`). A
   session from any other address only ever sees a "cannot use SignMeUp"
   screen with a sign-out button.

What happens on first sign-in:

- A new address gets a **student** account with an empty record and access to
  REG, ER, MAJOR and FCI. Its name comes from the Clerk profile.
- An address listed in `VITE_ADMIN_EMAILS` becomes a **system administrator**
  with every access area instead.
- An address that an administrator has already added under *Authorized users*
  takes the role and access areas assigned there.

Administrators manage users from `/users`: add a person by employee number
(students by their 8-digit student ID, which also starts their student record),
SDSU email, job title, role and access areas, and change any of those later.
Administrators can also **initialize or reset a password** there (FW-05,
FW-07): the app sends it to `POST /api/password`, which checks the caller is an
administrator and passes it to Clerk's Backend API. It is never written to the
SignMeUp database. Users can still reset their own with "Forgot password" on the
sign-in page.

The sample university (students, staff, courses, grades) is still seeded into
the browser so every screen has data. Its staff records use placeholder
`@signmeup.example` addresses and cannot sign in. "Reset sample data" on the
sign-in page restores the seed.

#### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `.env.local`, Vercel | Clerk publishable key (`pk_test_…` / `pk_live_…`). Public by design. Required; without it the app shows a configuration error instead of a sign-in form. |
| `VITE_ADMIN_EMAILS` | `.env.local`, Vercel | Optional. Comma-separated sdsu.edu addresses that become administrators on first sign-in. |
| `CLERK_SECRET_KEY` | `.env.local`, Vercel (server only) | Written by `clerk env pull`. Used only by `api/password.ts` so administrators can set passwords; without it that feature reports that it is unavailable. Never commit it or prefix it with `VITE_`. |

Both `VITE_` values are baked into the bundle at build time, so changing them
on Vercel requires a redeploy.

#### Local setup

```bash
cp .env.example .env.local        # then paste the publishable key
# or, with the Clerk CLI (https://clerk.com/docs/cli):
clerk auth login
clerk link --app app_3JhyENn4DgP4AcYl7riMq5k7nj3   # the "SignMeUp" application
clerk env pull                    # writes VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local
```

Clerk's prebuilt UI is bundled from `@clerk/ui` rather than loaded from
Clerk's CDN, so the sign-in form works wherever the app is served.

#### Recreating the Clerk configuration

If you set up a fresh Clerk application, the instance needs the same
restrictions. With the CLI linked to it:

```bash
clerk api /allowlist_identifiers -d '{"identifier":"*@sdsu.edu","notify":false}' --yes
clerk config patch --yes --json '{"auth_access_control":{"allowlist_enabled":true,"allowlist_blocklist_enforced_on_sign_in":true}}'
clerk api /allowlist_identifiers      # verify the entry
clerk doctor                          # verify the project wiring
```

In the Clerk Dashboard the same settings live under *Restrictions*: enable
the allowlist and add the `sdsu.edu` domain.

#### Deployment (Vercel)

The site deploys from `main` to <https://signmeup-pi.vercel.app>. Set the two
`VITE_` variables in the Vercel project (Production, Preview and Development)
and redeploy after changing them:

```bash
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
vercel env add VITE_ADMIN_EMAILS production
vercel redeploy <latest-production-deployment-url>
```

#### Current limits

- The linked Clerk application only has a **development** instance, which is
  free but has usage limits and shows a "Development mode" badge on the form.
  Going to production needs a production instance with a domain, production
  keys on Vercel, and a paid Clerk plan for the allowlist feature.

### Shared database (Supabase)

Storage is relational. The tables are defined in [db/schema.sql](db/schema.sql)
(departments, users and access areas, terms, faculty and catalog with their
many-to-many links, majors and outlines with history, students with notes and
completed and transfer courses, sections, registrations and grades, general
grade notes, value lists, help topics, and the transaction log). The API applies
that file automatically the first time it connects, so a fresh Supabase project
needs nothing but `DATABASE_URL`.

The browser still works with one document that mirrors those tables:

- `GET /api/db` assembles the document from the tables and returns
  `{ version, db }`.
- `PUT /api/db` with `{ version, db }` diffs the document against the current
  rows and applies the difference as inserts, updates and deletes inside one
  transaction that locks the `document_version` row (compare-and-set). On a
  version mismatch it answers `409` with the current document; the browser
  rebases its unsaved changes and retries, so two people acting at once never
  overwrite each other. Open tabs also poll every 15 seconds.
- Notes, outline history and the transaction log are append-only: a database
  trigger rejects updates and deletes (ER-03, MAJ-07, GEN-08). Only an
  administrator's sample-data reset may cascade-delete them.
- Every request must carry the Clerk session token. The function verifies it
  against Clerk's public JWKS (derived from the publishable key, so no secret
  is needed) and reads the caller's email from the token's `email` claim.
- **Roles are protected server-side** (`src/lib/sync-rules.ts`). A non-admin
  write may not add, remove or change any user except to create the caller's
  own account on first sign-in as a plain student (or as an administrator when
  the address is in `VITE_ADMIN_EMAILS`) and to record sign-in times. Anything
  else answers `403` and the browser discards the change.
- **Every other object is protected too** (`api/_lib/permissions.ts`,
  GEN-05). Each write is compared with the stored rows table by table, and
  each added, changed or removed row must be allowed for the caller:

  | Object | Who may change it |
  |---|---|
  | Own registrations | the student (ungraded only); staff with REG for anyone |
  | Student record | staff with ER; the student for their own telephone and address |
  | Student notes | staff with ER, or the student on their own record; append-only, stamped with the author's own ID |
  | Completed and transfer courses | staff with ER |
  | Grades and grade notes | the section's primary instructor during the grade window, or registrar staff with GRADE at any time |
  | Approved outlines | an advisor listed for that major, or registrar staff, with MAJOR; entries and history are never deleted |
  | Catalog, schedule, majors, value lists, help | registrar staff |
  | Transaction log | anyone, append-only, labeled with the caller's own name |

  Administrators may change anything. A refused write answers `403` with the
  reason, and the browser shows it and restores what it had before.
- The page footer shows the round-trip time of the last accepted write, which
  is how the 5-second response requirement (GEN-02) is checked.

The translation between document and tables lives in `api/_lib/mapping.ts`
and is covered by a round-trip test over the whole sample university. The
sample university is loaded by the first sign-in (the browser seeds the
document; the API writes the rows), so no separate seed script is needed.

How someone gets a role, in order of precedence:

1. An administrator already added their SDSU email under *Authorized users*:
   they get that role and those access areas on first sign-in.
2. Their email is in `VITE_ADMIN_EMAILS`: system administrator.
3. Otherwise: student, with an empty record.

Server configuration:

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel only | Supabase Postgres connection string (the *Session pooler* URI on port 5432 works). Server-side only; never prefix with `VITE_`. Kept in Doppler (project `course-registration`, config `prd`) and copied to Vercel from there. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Vercel | Also read by the API to find Clerk's JWKS. |
| `VITE_ADMIN_EMAILS` | Vercel | Also read by the API to allow admin bootstrapping. |

The Clerk instance must add the email to session tokens. It is configured
(Dashboard: *Sessions → Customize session token*, or with the CLI):

```bash
clerk config patch --yes --json '{"session":{"claims":{"email":"{{user.primary_email_address}}"}}}'
```

If `DATABASE_URL` is missing or the API is unreachable (for example under plain
`npm run dev`, which serves no functions), the app falls back to **local mode**:
a banner says so, and changes stay in that browser's `localStorage`. Run
`vercel dev` with a `.env.local` that has `DATABASE_URL` to exercise the API
locally.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the rules
npm run typecheck
npm run build
```

Design: the chosen direction and Claude Design prompt are in
[docs/DESIGN-HANDOFF.md](docs/DESIGN-HANDOFF.md).

## Development

Work happens on feature branches, merged to `main` via pull requests.

```bash
git checkout -b my-feature
# ...commit work...
git push -u origin my-feature
gh pr create
```

## CI

Every pull request and every push to `main` runs the
[CI workflow](.github/workflows/ci.yml):

- **Repo sanity** — always runs: verifies the docs are present and no
  merge-conflict markers or files over 10 MB slip in.
- **Node.js checks** — if a `package.json` exists: installs dependencies and
  runs the `lint`, `typecheck`, `test`, and `build` scripts (each only if
  defined).
- **Python checks** — if a `pyproject.toml` or `requirements.txt` exists:
  installs dependencies and runs `pytest` (if tests are present).

So the gate is live from day one and picks up real checks automatically as soon
as code with a recognized toolchain lands.
