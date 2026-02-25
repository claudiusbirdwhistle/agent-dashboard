# CLAUDE.md — Dashboard v2 (Next.js)

## Mission

Build a **new dashboard from the ground up** at `/agent/dashboard-next/`
using Next.js, React, Tailwind, Tremor, and TypeScript. This runs on
port 3001 alongside the existing Express dashboard (port 3000). The
existing Express server remains the sole data layer — the new app is a
frontend that consumes its APIs.

The full design is in
[`docs/plans/2026-02-25-dashboard-next-design.md`](/agent/docs/plans/2026-02-25-dashboard-next-design.md).

Prior instructions for the broader codebase refactor are in
`CLAUDE.dev.md`.

## Principles

- **Test-first, always.** Write a failing test before writing any
  production code. Every test must be seen to fail before it passes.
  No exceptions. Use the red-green-refactor cycle:
  1. Write a test that defines the expected behavior. Run it. Watch
     it fail.
  2. Write the minimum production code to make it pass.
  3. Refactor. Confirm tests still pass.
- **No production code without a test.** If you can't write a test
  for it, reconsider the design. Untested code is unfinished code.
- **Clean code.** Small functions that do one thing. Descriptive names.
  No dead code, no commented-out code, no TODO comments that linger.
  If a function is longer than ~40 lines, break it up. If a module is
  longer than ~300 lines, split it.
- **Don't break the old dashboard.** The Express server on port 3000
  must keep working throughout. The only changes to `server.js` are
  additive: directive CRUD endpoints and `walkDir` skip list updates.
- **Commit early, commit often.** Every invocation produces at least
  one commit on the current feature branch. See the Git Workflow
  section for branching rules, merge policy, and commit conventions.

---

## Git Workflow

### Branch structure

```
main   ← production, human-supervised merges only. Never touch this.
  └── dev   ← integration branch, receives completed features
        ├── feature/scaffold-nextjs
        ├── feature/auth
        ├── feature/directives-api
        ├── feature/directives-ui
        ├── feature/file-viewer
        └── feature/...
```

### Rules

- **Every significant feature gets its own branch** cut from `dev`.
  A "significant feature" maps roughly to one item in the
  Implementation Order list — scaffolding, auth, directives API,
  directives UI, file viewer, etc. Small fixes or documentation
  changes can go directly on `dev`.

- **Every invocation produces at least one commit** on the current
  feature branch. An invocation with no commit is a stall.

- **Merge to `dev` when a feature is complete** — meaning all its
  tests pass, the server runs without errors, and the implementation
  matches the design. Use a regular merge commit (not squash) to
  preserve the per-invocation history.
  ```bash
  git checkout dev
  git merge --no-ff feature/<name> -m "feat(<scope>): complete <feature>"
  git branch -d feature/<name>
  ```

- **Never merge `dev` into `main`.** That step requires human
  review and is not your responsibility. When `dev` reaches a
  meaningful milestone you consider shippable, note it in
  `next_prompt.txt`. The operator will handle the merge.

### Starting a new feature

At the beginning of the invocation where you start a new feature:
```bash
git checkout dev
git pull origin dev          # sync before branching
git checkout -b feature/<name>
```

Use kebab-case names that match the implementation step:
`feature/scaffold-nextjs`, `feature/auth`, `feature/directives-api`,
`feature/directives-ui`, `feature/file-viewer`, `feature/security`.

### Commit message convention

```
type(scope): short description
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`
Scopes: `dashboard-next`, `directives`, `auth`, `file-viewer`, `express`

Every commit on a feature branch should leave the code in a
runnable state — no broken builds mid-branch.

---

## Architecture

```
Browser ──> Next.js (port 3001) ──> Express (port 3000) ──> Filesystem
            UI only                  Data layer               /state/
            Session auth             Bearer token auth        /output/
            React Query polling      All API endpoints        /tools/
                                                              /agent/
                                                              /var/log/agent/
```

- **Next.js** handles: UI rendering, session auth (login/logout), page
  routing, client-side state
- **Express** handles: all filesystem I/O, tool data APIs, directive
  CRUD, file viewer, live logs, agent status/toggle
- **Communication:** React Query polls Express APIs at 2s (live), 5s
  (status/directives), 15s (file trees). Next.js attaches the
  `DASHBOARD_TOKEN` as a Bearer header server-side — the browser never
  sees the Express token.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS 4 |
| Components | Tremor |
| Data fetching | React Query (TanStack Query) |
| Auth | iron-session + bcrypt |
| Markdown | react-markdown or marked |
| Syntax highlighting | shiki or highlight.js |
| Testing | Jest + React Testing Library + supertest |

---

## V1 Scope

### Included

- Login page (username/password, session cookie via iron-session)
- User management CLI (`npm run create-user`, `npm run delete-user`)
- Main dashboard (status KPIs, live event stream, agent toggle)
- Directives page (submit form with type + priority, directive list,
  status badges, polling, toast notifications)
- File viewer (all 5 directories: output, state, tools, agent, logs)
  with syntax highlighting and lazy-loading tree
- Sidebar with nav, inline pending directives, quick links
- Directive CRUD endpoints added to Express `server.js`
- `walkDir` skip list updates (skip `data/`, `.venv/`)
- Firewall rule to open port 3001
- Full test suite

### Deferred (V2)

- 14 tool data pages (build 1-2 as a template in V1, rest in V2)
- Migrating Express API routes into Next.js
- Decommissioning old dashboard on port 3000
- SSE or WebSocket upgrade for real-time data

---

## Directive Types

Directives have a `type` field that tells the agent how to interpret
them:

| Type | Example | Agent behavior |
|------|---------|---------------|
| `task` | "Add CORS headers to Express" | Adds to `dev-objectives.json` as a work item. Do it, mark done. |
| `focus` | "Drop everything, focus on testing" | Reorders objectives, updates `active` to the new priority. Suspends current work. |
| `policy` | "Always run tests before committing" | Appends to `/state/agent-policies.json`. Standing constraint on all future invocations. |

### Directive schema

```json
{
  "id": "dir-<unix_ms>-<6_hex>",
  "text": "...",
  "type": "task | focus | policy",
  "priority": "urgent | normal | background",
  "status": "pending | acknowledged | completed | deferred | dismissed",
  "created_at": "ISO-8601",
  "acknowledged_at": null,
  "completed_at": null,
  "agent_notes": null
}
```

Storage: `/state/directives.json`. Atomic writes (temp file + rename)
for concurrency safety.

---

## Express Changes (Additive Only)

These are the only modifications to the existing `server.js`:

1. **Directive CRUD endpoints:**
   - `POST /api/directives` — create
   - `GET /api/directives` — list (optional `?status=` filter)
   - `PATCH /api/directives/:id` — update
   - `DELETE /api/directives/:id` — delete

2. **`walkDir` skip list:** Add `data/` and `.venv/` to the skip list
   so the file viewer doesn't enumerate 1.5GB of cached data.

3. **Firewall:** Open port 3001 for the Next.js app.

No existing endpoints are modified. No existing behavior changes.

---

## Project Structure

```
/agent/dashboard-next/
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local
├── .env.example
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (shell)
│   │   ├── page.tsx                # Main dashboard
│   │   ├── login/page.tsx          # Login form
│   │   ├── directives/page.tsx     # Directives panel
│   │   ├── files/[[...path]]/page.tsx  # File viewer
│   │   └── tools/[tool]/page.tsx   # Tool page (V1: 1-2)
│   │
│   ├── components/
│   │   ├── layout/                 # Sidebar, Header, Shell
│   │   ├── directives/            # Form, List, Card, Badge
│   │   ├── files/                 # FileTree, FileViewer, Markdown
│   │   ├── live/                  # EventStream, EventCard
│   │   └── ui/                    # Toast, shared primitives
│   │
│   ├── lib/
│   │   ├── api.ts                 # Fetch wrapper (attaches auth)
│   │   ├── auth.ts                # Session helpers
│   │   └── hooks/                 # useStatus, useDirectives, useLive,
│   │                              # useFileTree, useFile
│   │
│   ├── middleware.ts              # Session gate → /login
│   └── types/index.ts            # Shared TS types
│
└── __tests__/
    ├── directives.test.ts
    ├── auth.test.ts
    ├── file-viewer.test.ts
    ├── directives-concurrency.test.ts
    ├── directives-security.test.ts
    └── components/
        ├── DirectiveForm.test.tsx
        ├── DirectiveList.test.tsx
        └── FileTree.test.tsx
```

---

## Testing

**All tests must pass before any code is deployed.** This is a hard
gate.

### Infrastructure

- Jest + supertest + React Testing Library
- `npm test` runs full suite
- `__tests__/` at project root

### Required test coverage

**API tests** — Directive CRUD: create, reject invalid input, list,
filter by status, update, reject bad transitions, delete, 404 on
missing, 401 without auth.

**Concurrency tests** — Simultaneous writes to `directives.json` don't
corrupt data. Read during write returns valid state.

**Auth tests** — Login success/failure, session redirect, logout,
create-user generates valid bcrypt hash.

**File viewer tests** — Directory listing, file content, path traversal
rejection, symlink rejection, `walkDir` skip list.

**Component tests** — DirectiveForm validates and submits,
DirectiveList groups by status, FileTree expands/collapses,
StatusBadge renders correct colors.

**Security tests** — XSS in directive text escaped, shell
metacharacters stored literally, oversized bodies rejected, malformed
JSON returns 400.

---

## Implementation Order

Each step committed before moving to the next.

1. **Scaffold Next.js project** — `create-next-app`, add Tailwind,
   Tremor, React Query, iron-session, TypeScript config. Open port
   3001 in firewall. Commit.
2. **Test infrastructure** — Jest, supertest, React Testing Library.
   Wire `npm test`. Commit.
3. **Auth (test-first)** — Tests for login/logout/session. Then
   implement login page, middleware, user management CLI. Commit.
4. **Directives API (test-first)** — Failing tests for Express CRUD
   endpoints. Then implement in `server.js`. Commit.
5. **Directives UI** — DirectiveForm, DirectiveList, DirectiveCard,
   StatusBadge, toast notifications. Commit.
6. **Main dashboard** — Shell layout, sidebar, header, status KPIs,
   live event stream. Commit.
7. **File viewer (test-first)** — Tests for new directories.
   `walkDir` skip list update. FileTree, FileViewer, breadcrumbs,
   syntax highlighting. Commit.
8. **Security hardening** — Security tests, input sanitization
   verification. Commit.
9. **1-2 tool pages** — Port as V1 template to prove the pattern.
   Commit.

---

## State Files

You have no memory between invocations except what you write to disk.
There are exactly two state files you must maintain.

**`/state/dev-objectives.json`**
Your work backlog and current breadcrumb. Top-level structure:

```json
{
  "active": {
    "id": "directives-ui",
    "notes": "One sentence: what was done so far and what comes next."
  },
  "items": [
    {
      "id": "scaffold-nextjs",
      "description": "Scaffold dashboard-next with create-next-app + deps",
      "status": "pending | active | completed | blocked",
      "depends_on": [],
      "created_at": "2026-02-25T...",
      "completed_at": null
    }
  ]
}
```

- `active` is your breadcrumb. Set it at the start of every invocation
  (even if the id is unchanged — update the `notes` to reflect where
  you are right now). Update it again at the end.
- When you finish an objective, set its `status` to `"completed"` and
  set `completed_at`. Move `active` to the next unblocked item.
- Add new items to `items` as work is discovered.

**`/state/next_prompt.txt`**
Written **twice** every invocation:

- **At the start** (before any work): overwrite with
  `"Currently working on: <id> — <one-line context>. If this invocation
  crashed, retry from this point."`
- **At the end** (after committing): overwrite with
  `"Completed: <what was done>. Next: <next objective id and first action>."`

The supervisor feeds `next_prompt.txt` verbatim as the prompt to the
next invocation. If the agent crashes mid-invocation, the next
invocation will read the "Currently working on" line and know exactly
what to retry.

### State Safety

- Write to a temp file first, then rename into place (atomic writes).
- If `dev-objectives.json` is missing or malformed, reconstruct it from
  `next_prompt.txt` and the git log.

---

## Invocation Discipline

Every invocation must follow this sequence:

1. **Read state** — Read `/state/dev-objectives.json` and
   `/state/next_prompt.txt`. Read `/state/directives.json` if it
   exists. Then read the design doc:
   `/agent/docs/plans/2026-02-25-dashboard-next-design.md`.
   The `active` field in objectives tells you exactly where the
   previous invocation left off. The `next_prompt.txt` tells you
   what to do if it completed cleanly, or what to retry if it crashed.

2. **Claim the work** — Overwrite `next_prompt.txt` with:
   `"Currently working on: <id> — <one-line context>. If crashed, retry from here."`
   Update `active.notes` in `dev-objectives.json` with a one-line
   breadcrumb. Do this before touching any code.

3. **Create a task list** — Use `TodoWrite` to create a checklist for
   this invocation. The final two items must always be:
   - `Update dev-objectives.json (active + status)`
   - `Update next_prompt.txt (completion)`
   Keep the list to 3–5 items total so it fits within the turn budget.

4. **Do one unit of work** — One component, one endpoint, one test
   suite. Not the whole feature. Not two features.

5. **Verify** — Run `npm test`. Confirm nothing regressed.

6. **Commit** — Atomic git commit with a conventional message.

7. **Update state** — Mark the two final todo items done:
   - In `dev-objectives.json`: if the objective is finished set
     `status: "completed"` and `completed_at`; move `active` to the
     next unblocked item with a fresh `notes`.
   - Overwrite `next_prompt.txt` with:
     `"Completed: <what was done>. Next: <next objective id and first action>."`

**Hard rule: stop implementation work by turn 15.** Use remaining
turns for verification, committing, and step 7. If you are on turn 15
or later, do not begin any new implementation work. A half-finished
feature with updated state is far more valuable than a finished feature
the next invocation can't find.

**Stall thresholds:**
- 3 consecutive stalls (no commit): change approach.
- 5 consecutive stalls: pick a different step from the implementation
  order.
- 8 consecutive stalls: write `disabled` to `/state/agent_enabled`.

---

## What NOT to Do

- Don't modify existing Express endpoints or their response formats
- Don't write tests that pass on the first run
- Don't deploy untested code
- Don't commit `node_modules/`, `.next/`, `.env.local`,
  `directives.json`
- Don't add SSR for data pages — use client-side React Query
- Don't touch the old dashboard's frontend code
