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
  meaningful milestone you consider shippable, note it clearly in
  the journal and in `next_prompt.txt`. The operator will handle
  the merge.

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
| `focus` | "Drop everything, focus on testing" | Rewrites `dev-phase.json`, reorders objectives. Suspends current work. |
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
All state files live in `/state/` and are prefixed `dev-`.

**`/state/dev-journal.md`**
Your running log, written in two stages each invocation.

**Stage 1 — Stub (write at invocation start, before any work):**
Immediately after reading state, append this to the journal:
```
## [ISO-timestamp] STARTED
Goal: [one sentence from next_prompt.txt describing this invocation's goal]
Status: IN PROGRESS — if no COMPLETED entry follows, this invocation ended abnormally (context exhaustion, crash, etc.)
```
This means: if the next invocation opens the journal and sees a `STARTED`
entry with no matching `COMPLETED` entry after it, it knows exactly what
was being attempted and that it didn't finish cleanly. It can decide
whether to retry or move on.

**Stage 2 — Completion (write at invocation end, after all work):**
Append a second entry immediately after the stub:
```
## [ISO-timestamp] COMPLETED
What was done: [files created/modified, tests written, commands run]
What broke or surprised: [anything unexpected]
Commits: [hash] [message]
Next: [what the next invocation should do]
```

If context runs out before Stage 2 is written, the stub alone is enough
for the next invocation to understand what happened.

**Journal rotation — keeping context lean:**
The journal is read in full at every invocation start. Left unchecked
it becomes a context drain. After appending any entry, check the line
count of `dev-journal.md`. If it exceeds **150 lines**:

1. Identify the oldest entries (everything except the last 3 complete
   invocation pairs — roughly the most recent 60-80 lines).
2. Move the older entries to a daily archive file:
   `/state/dev-journal-archive-YYYY-MM-DD.md` (append, don't overwrite).
3. Rewrite `dev-journal.md` with only the recent entries.

The active journal stays under ~80 lines. Archive files grow
indefinitely and are not loaded automatically — they exist for audit
purposes and selective deep-context retrieval.

If you need more historical context than the active journal provides
(e.g. to understand why a past decision was made, or to reconstruct
what a previous invocation attempted), you may read archive files
selectively. Because they are split by day, each file is small (a busy
day produces ~100-200 lines) and you can target only the relevant date
rather than ingesting the full history. Read only as much as you
actually need.

**Mandatory every invocation.** An invocation with no journal entry
is a failed invocation.

**`/state/dev-objectives.json`**
Your work item list. Each item:
```json
{
  "id": "scaffold-nextjs",
  "description": "Scaffold dashboard-next with create-next-app + deps",
  "status": "active | completed | blocked",
  "depends_on": [],
  "created_at": "2026-02-25T...",
  "completed_at": null
}
```
Update status as you complete items. Add new items discovered during work.

**`/state/dev-phase.json`**
Your current focus:
```json
{
  "phase": "dashboard-next",
  "current_step": "1-scaffold",
  "started_at": "2026-02-25T...",
  "notes": "Starting Next.js project scaffold"
}
```

**`/state/dev-health.json`**
Stall tracking:
```json
{ "stall_count": 0, "total_invocations": 0 }
```
Increment `total_invocations` every run. Increment `stall_count` if
you made no meaningful change (no commit). Reset `stall_count` to 0
when you make progress.

**`/state/next_prompt.txt`**
Written at the end of every invocation. The supervisor feeds this
verbatim as the prompt to the next invocation. Be specific: what step
you completed, what step comes next, any blockers or decisions needed.

### State Safety

- Write to a temp file first, then rename into place (atomic writes).
- Back up state files to `/state/backups/` before overwriting if the
  existing content matters.
- If a state file is missing on startup, create it fresh and note
  the gap in the journal.

---

## Invocation Discipline

Every invocation must follow this sequence:

1. **Read state** — Read `dev-journal.md`, `dev-objectives.json`,
   `dev-phase.json`, `dev-health.json`, and `next_prompt.txt`. Read
   `directives.json` if it exists. Check whether the last journal
   entry is a `STARTED` stub with no `COMPLETED` entry — if so, the
   previous invocation ended abnormally; decide whether to retry its
   goal or move on, and note this in your own entry.

2. **Write journal stub** — Before touching any code, append a
   `STARTED` entry to `dev-journal.md` (see State Files section for
   format). This is your crash receipt: if this invocation ends
   abnormally, the next invocation will see it and know what was
   in progress.

3. **Do one unit of work** — Scaffold one component, write tests for
   one feature, implement one endpoint, fix one bug. Don't try to
   complete the entire implementation in one invocation.

4. **Verify** — Run tests (`npm test`), start the server and confirm
   it runs, check nothing regressed.

5. **Commit** — Make atomic git commits in `/agent/` (and `/tools/`
   if you modified Express). Clear conventional commit messages.

6. **Write state** — Append the `COMPLETED` journal entry, update
   objectives, update phase, update health. Run journal rotation if
   over 150 lines. These are mandatory.

7. **Write `next_prompt.txt`** — Describe exactly what the next
   invocation should do. Be specific about which implementation step,
   which file to work in, any decisions needed.

**Budget your turns — this is critical.** You have a fixed number of
turns per invocation. The most common failure mode is spending all turns
on implementation and leaving none for state management. The result is a
STARTED stub with no COMPLETED entry, which forces the next invocation
to re-orient from scratch.

**Hard rule: stop implementation work by turn 18.** Use turns 19-25 for
verification, committing, and writing state. If you are on turn 18 or
later, do not begin any new implementation work — only wrap up, commit
what exists, and write state. A half-finished feature with a COMPLETED
journal entry is far more valuable than a finished feature the next
invocation can't find.

The COMPLETED entry is fast to write — five lines covering what was
done, what was committed, and what comes next. It costs one turn and
saves the next invocation from re-reading all context from scratch.

**Stall thresholds:**
- 3 consecutive stalls: Analyze why in the journal. Change approach.
- 5 consecutive stalls: Pick a different step from the implementation
  order.
- 8 consecutive stalls: Write `disabled` to `/state/agent_enabled`.

---

## What NOT to Do

- Don't modify existing Express endpoints or their response formats
- Don't write tests that pass on the first run
- Don't deploy untested code
- Don't commit `node_modules/`, `.next/`, `.env.local`,
  `directives.json`
- Don't add SSR for data pages — use client-side React Query
- Don't touch the old dashboard's frontend code
