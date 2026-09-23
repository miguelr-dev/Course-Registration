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
│   └── CourseRegReqs.docx    # original requirements document
├── .env.example              # Clerk publishable key + optional admin list
├── src/
│   ├── data/                 # types, sample data seed, in-browser store
│   ├── lib/                  # registration rules, GPA/statistics, wildcard search, formatting
│   ├── components/           # app shell, help drawer, icons, shared UI
│   ├── screens/              # one file per screen (see below)
│   └── styles/global.css     # design tokens and component styles
├── vercel.json               # single-page-app rewrite for Vercel
└── .github/workflows/ci.yml  # CI checks, run on every PR and push to main
```

## The prototype

A React + TypeScript single-page app (Vite). Data lives in the browser
(`localStorage`) and is seeded with a small sample university, so every screen
is functional without a backend: registration rules are enforced, notes and
outline history are append-only, grades update statistics live, and every
transaction is labeled with the user's name, date and time.

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

### Signing in

Authentication is handled by [Clerk](https://clerk.com). Anyone with an
**@sdsu.edu** address can create an account and sign in; the Clerk instance's
allowlist refuses every other domain, and the app checks the domain again
before it lets a session through. A new address gets a student account with an
empty record on first sign-in. An administrator can add a person from
*Authorized users* with their SDSU email and the access areas they should have;
that role applies the first time the address signs in. Addresses listed in
`VITE_ADMIN_EMAILS` become administrators automatically.

The sample university (students, staff, courses, grades) is still seeded into
the browser so every screen has data; its staff records are placeholders that
cannot sign in. "Reset sample data" on the sign-in page restores the seed.

Local setup:

```bash
cp .env.example .env.local   # then paste the Clerk publishable key
# or, with the Clerk CLI: clerk link && clerk env pull
```

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
