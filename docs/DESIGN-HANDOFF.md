# SignMeUp — UI Design Handoff & Claude Design Prompt

Handoff for the SignMeUp UI, the CS 532 course registration system. Full
requirements: [REQUIREMENTS.md](REQUIREMENTS.md) (source:
[CourseRegReqs.docx](CourseRegReqs.docx)).

## Status

- **Chosen direction: V2 "Clean SaaS".** Four directions were explored on one
  canvas (Collegiate Classic, Clean SaaS, Warm Academic, Night Registrar) and
  V2 was picked. The unchosen sketches stay on the canvas's second page.
- **Canvas:** https://claude.ai/artifact/S7etZLMFTyPYHZ7fP3xtfq — eight
  desktop screens in V2, editable in place and exportable as PNG/PDF.

Everything below the divider is a self-contained prompt — paste it into
Claude Design as-is to regenerate or extend the screens.

---

## PROMPT FOR CLAUDE DESIGN

Design the web UI for **SignMeUp**, a university course registration system
for a small university (~2,000 students), in the **"Clean SaaS"** direction
described below. Produce **eight desktop screens (1440×900)** that share one
component vocabulary, plus the same student's data threaded through every
screen so the set reads as one product.

### Product context

SignMeUp integrates five subsystems behind one login (the "Framework"):

- **ER — Electronic Student Record:** student info (ID, name, phone, address,
  date of birth, major, minor), completed / transfer / current courses, GPA,
  append-only notes stamped with date, time and the employee ID of the author.
- **REG — Course Registration:** course offerings by department (Course ID,
  Schedule #, days/time, location, instructor, units, prerequisites, seats),
  registration one course at a time, and a "major courses I'm eligible for"
  list (on approved outline + prerequisites completed + seats open).
- **MAJOR — Major Course Requirements:** per major: Major ID, title,
  department, units required, required courses, electives, advisors. Per
  student: an approved outline whose entries are approved / dropped / waived,
  each with a status date, the approving advisor and last-approved date. Outline
  entries are never deleted; a change history is kept.
- **FCI — Faculty & Course Information:** faculty (ID, name, title, office,
  phone, office hours, department, departments taught in) and courses (ID,
  title, description, prerequisites, units, qualified faculty), queried by
  faculty ID, faculty name, course ID or course title with `*` wildcards.
- **GRADE — Course Grades:** grade entry by the primary instructor (letter,
  credit/no-credit or audit by registration type), per-grade notes, general
  notes, "updated by" tracking when someone other than the instructor changes
  a grade, and course / department / university statistics (registered,
  passing, average grade, % A/B/C/D/F).
- **Framework:** sign-in, authorized-user maintenance (name, employee number,
  job title, access areas), password reset, user report without passwords.

Users: students, faculty, advisors, registrar staff and system administrators.
Roles gate what each sees.

### Requirements that must be visible in the design

- **Menu-driven, shallow navigation:** persistent left nav naming the five
  subsystems by code and name (ER, REG, MAJOR, FCI, GRADE); admins also see
  Authorized Users. Every screen has Help and Print in the header (any display
  can be printed; context help is available on every screen).
- **Transaction labeling:** completed actions show the user's name, date and
  time (e.g., "Registered by Maria Okafor-Reyes · Sep 12, 2026, 2:41 PM").
- **Validation on entry:** inline error states state (1) the reason for
  rejection and (2) the minimum requirement to pass, e.g. "Prerequisite CS 310
  not completed — complete it or request an advisor waiver to register."
- **Cancel and restore:** any in-progress action has a "Cancel and restore"
  control.
- **Append-only records:** notes and outline history show they cannot be
  deleted.
- **Hyphenated names and wildcard search** appear in sample data and search
  hints (e.g., "Maria Okafor-Reyes", "Hwang-*").
- **Status chips:** approved / dropped / waived; prerequisite met / not met;
  low-seats warning. Never color alone — pair each with an icon or label.

### The eight screens

1. **Sign in (Framework).** ID + password, one inline error on the ID field
   ("ID not found. Enter your 8-digit student or employee number, digits
   only."), note that an administrator resets passwords.
2. **Student dashboard (REG).** Header with name, ID, major, term. "My
   schedule" card: 3 registered courses with running units total and the last
   transaction stamp. "Eligible major courses" panel: rows with prerequisite
   chip, seats chip (one row "2 seats left"), Register button. Footer block of
   this term's outline changes showing Approved, Waived and Dropped chips.
3. **Course search & registration (REG).** Search with wildcard, department
   and term filters, "seats available only". Results table; one row expanded
   with description and prerequisite completion. Right side panel "Confirm
   registration" showing the prerequisite validation error, a disabled
   Register button, "Request advisor waiver", "Cancel and restore", and the
   last-transaction stamp.
4. **Student record (ER).** Student header with all identity fields; tiles for
   GPA, units completed (this university vs transfer), units in progress,
   standing. Tabs: Completed here / Transfer / Current. Notes column: append-only
   entries with category chip, timestamp and employee ID, plus an "Append note"
   form. Print options: include course detail, this university only / all.
5. **Approved major outline (MAJOR, advisor view).** Major summary (ID, units,
   required courses, electives, advisors), progress bars against the outline,
   outline table with status chip + status date + completion, and a change
   history block that says entries are never deleted.
6. **Faculty & courses (FCI).** Query bar (search by, query with wildcard,
   department), results list, selected faculty detail card, "Authorized to
   teach" course table.
7. **Grade sheet (GRADE, faculty view).** Course header (ID, department,
   schedule #, time, location, instructor, units), info banner on the grade
   entry window and update-privilege rule, student table with grade selects,
   one Incomplete with a note, one grade "Updated by" a registrar with a
   timestamp, course statistics panel (registered, passing, average, A–F
   distribution), general notes.
8. **Authorized users (Framework, admin view).** Searchable user table (name,
   employee #, job title, access-area chips), report scope (whole system / one
   subsystem), right side panel "Reset password" with temporary password rule,
   force-change-at-next-sign-in, and a transaction stamp.

### Direction: "Clean SaaS"

- **Palette:** indigo `#4F46E5` primary (hover `#4338CA`, tint `#EEF2FF`,
  tint text `#3730A3`); slate neutrals (`#0F172A` text, `#64748B` muted,
  `#F8FAFC` page background, `#FFFFFF` surfaces, `#E2E8F0` borders, `#F1F5F9`
  row dividers). Status: success text `#065F46` on `#ECFDF5`; warning text
  `#92400E` on `#FEF3C7`; danger text `#B91C1C` on `#FEE2E2`; inline field
  errors `#DC2626` on white. All pairs meet WCAG AA at 12px semibold.
- **Type:** Inter throughout, tabular numerals for IDs, units and seats.
  H1 26/700, H2 16/600, section labels 12/600 uppercase, body 14, detail 12.
- **Shape:** 8px radius on cards, inputs and buttons; pill chips; 1px borders
  with a 1px/2px shadow at most. 36px controls, 30px compact controls in
  table rows.
- **Layout:** 240px left nav, 40px page gutters (32px when a 340px side
  panel is open), 24px gaps, cards with a 16px/20px head.
- **Feel:** Linear/Stripe-grade product UI — quiet borders, hierarchy from
  weight and size rather than color, one accent.

### Rules

- Same student ("Maria Okafor-Reyes", ID 20231847, Computer Science B.S.,
  Fall 2026) and the same courses appear across screens; realistic CS / MATH
  / BIO courses, rooms and times, never lorem ipsum.
- Inline SVG icons only, no emoji.
- Keep the component inventory identical across screens: nav, page header
  with actions, data table, card, tile, status chip, primary / secondary /
  ghost button, input / select / checkbox, textarea, tabs, inline error,
  banner (info / warn / error), side panel, transaction stamp.
- Each artboard carries a small footer naming the screen and the direction.
