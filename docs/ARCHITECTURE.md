# SignMeUp architecture: modules

The requirements call for a modular system: it must be possible to add new
capabilities and to add, upgrade or replace software modules with relative ease
(GEN-15). SignMeUp does this by keeping the framework separate from the
subsystem modules, so the two only meet in one registry file.

## Layers

| Layer | Files | Knows about |
|---|---|---|
| Framework | `src/App.tsx`, `src/components/Shell.tsx`, `src/components/auth.tsx` | Sign-in, routing, the menu, help, printing, windows. Reads the module list; imports no screens. |
| Module registry | `src/modules.ts` | Each subsystem: access code, menu label, home path, routes. |
| Modules (screens) | `src/screens/*.tsx` | One file per screen. They use the store and shared UI, never each other. |
| Business rules | `src/lib/*.ts` | Pure functions (registration rules, GPA, names, wildcards, passwords). Unit tested; shared by browser and API. |
| Data | `src/data/store.tsx`, `src/data/sync.ts` | The single document and its actions, and the sync with the API. |
| API | `api/*.ts`, `api/_lib/*` | Vercel functions: the shared database (`/api/db`), passwords (`/api/password`). |
| Database | `db/schema.sql` | Relational tables in Supabase Postgres. |

```
App.tsx ──reads──▶ modules.ts ──lazy import──▶ screens/StudentRecord.tsx …
   │                                              │
   └──▶ Shell.tsx (menu from modules.ts)          └──▶ data/store.tsx ──▶ lib/*.ts
                                                            │
                                                            └──▶ /api/db ──▶ Postgres
```

## The registry

`src/modules.ts` lists the modules:

```ts
{
  code: 'GRADE', label: 'Course Grades', home: '/grades',
  routes: [
    { path: '/grades', load: () => import('./screens/GradeEntry') },
    { path: '/grades/:scheduleNo', load: () => import('./screens/GradeEntry') },
  ],
}
```

From this list the framework builds:

- the **menu** (only modules whose `code` is in the user's access areas),
- the **routes**, each wrapped in an access guard for that `code`,
- each user's **home screen** (the first module they can open).

Each screen is loaded with a dynamic `import()`, so Vite builds it as its own
bundle and the browser downloads it only when someone opens it.

## Adding a module

1. Add the access code to `Subsystem` in `src/data/types.ts`, to
   `VALUE_LISTS.subsystems` in `src/data/seed.ts`, and to the `subsystem` check
   in `db/schema.sql` (`user_access`).
2. Write the screen(s) in `src/screens/`, using `Shell` and `PageHeader` so they
   get Help, Print and New window.
3. Add an entry to `MODULES` and a help topic to `src/components/help.ts`.
4. Give users the new access area in Authorized Users.

`src/modules.test.ts` checks that every access area has exactly one module and
that no two modules claim the same path.

## Upgrading or replacing a module

Point the module's `routes` at a different screen file. Nothing else changes:
the menu, the access checks and the other modules stay as they are. Data
actions a screen needs are added to `src/data/store.tsx`, with any rules in
`src/lib/` so they can be tested on their own.
