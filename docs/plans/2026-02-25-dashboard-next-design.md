# Design: Next.js Dashboard (`dashboard-next`)

**Date:** 2026-02-25
**Status:** Approved
**Replaces:** Existing Express/vanilla JS dashboard at `/agent/dashboard/`

## Summary

Build a parallel dashboard from the ground up using Next.js, React,
Tailwind, Tremor, and TypeScript. The new dashboard lives at
`/agent/dashboard-next/` on port 3001 alongside the existing Express
dashboard on port 3000. The existing Express server remains the sole
data layer — the Next.js app is a pure frontend that consumes its APIs.

The new dashboard adds three capabilities the old one lacks: an agent
steering interface (directives), a full-project file viewer, and proper
session authentication. Once feature-complete, it replaces the old
dashboard entirely.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser                                            │
│  Next.js React app (port 3001)                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────────────┐  │
│  │ Directives│ │File Viewer│ │ Live / Status      │  │
│  │ Panel     │ │ (5 dirs)  │ │ + Agent Toggle     │  │
│  └─────┬─────┘ └─────┬─────┘ └────────┬──────────┘  │
│        │              │                │             │
│        └──────────────┼────────────────┘             │
│                       │  React Query (polling)       │
└───────────────────────┼─────────────────────────────┘
                        │ HTTP (Bearer token)
┌───────────────────────┼─────────────────────────────┐
│  Express server (port 3000)                         │
│                       │                              │
│  Existing endpoints:  │  New endpoints:              │
│  /api/status          │  POST   /api/directives      │
│  /api/toggle          │  GET    /api/directives      │
│  /api/file            │  PATCH  /api/directives/:id  │
│  /api/documents       │  DELETE /api/directives/:id  │
│  /api/state           │                              │
│  /api/live            │                              │
│  /api/logs            │                              │
│  /api/journal         │                              │
│  /api/<tool>/summary  │                              │
│                       │                              │
│  Reads/writes:        │                              │
│  /state/  /output/  /tools/  /agent/  /var/log/agent │
└─────────────────────────────────────────────────────┘
```

### Key architectural decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | Next.js + React + TypeScript | Modular, easily upgradable, App Router gives URL-addressable views |
| Styling | Tailwind CSS + Tremor | Tremor provides dashboard-ready components (KPI cards, badges, tables); Tailwind handles everything else |
| Data layer | Existing Express server on :3000 | Zero backend duplication, no risk to existing data APIs, fastest to ship |
| Realtime | React Query polling (2s/5s/15s) | Matches existing server capabilities, no backend changes needed |
| Auth | Session-based (username/password) | Proper auth with encrypted cookies, Express token stays server-side |
| Deployment | Port 3001, firewall opened | Clean parallel operation, swap to :3000 when ready to cut over |

### What Next.js does NOT do

- No API routes except auth (`/api/auth/login`, `/api/auth/logout`)
- No direct filesystem I/O — all data flows through Express
- No SSR for data pages — client-side fetching via React Query

---

## Project Structure

```
/agent/dashboard-next/
├── package.json
├── next.config.js              # Proxy /api/* to Express :3000
├── tailwind.config.js
├── tsconfig.json
├── .env.local                  # DASHBOARD_TOKEN, EXPRESS_URL, SESSION_SECRET
├── .env.example
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (sidebar + header shell)
│   │   ├── page.tsx            # Main dashboard (status + live output)
│   │   ├── login/
│   │   │   └── page.tsx        # Login form
│   │   ├── directives/
│   │   │   └── page.tsx        # Directives panel
│   │   ├── files/
│   │   │   └── [[...path]]/
│   │   │       └── page.tsx    # File viewer (catch-all route)
│   │   └── tools/
│   │       └── [tool]/
│   │           └── page.tsx    # Individual tool page (V1: 1-2 only)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Shell.tsx
│   │   ├── directives/
│   │   │   ├── DirectiveForm.tsx
│   │   │   ├── DirectiveList.tsx
│   │   │   ├── DirectiveCard.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── files/
│   │   │   ├── FileTree.tsx
│   │   │   ├── FileViewer.tsx
│   │   │   └── MarkdownRenderer.tsx
│   │   ├── live/
│   │   │   ├── EventStream.tsx
│   │   │   └── EventCard.tsx
│   │   └── ui/
│   │       └── Toast.tsx
│   │
│   ├── lib/
│   │   ├── api.ts              # Fetch wrapper: attaches auth, base URL
│   │   ├── auth.ts             # Session helpers
│   │   └── hooks/
│   │       ├── useStatus.ts    # Agent status (5s poll)
│   │       ├── useDirectives.ts # Directives (5s poll)
│   │       ├── useLive.ts      # Live output (2s poll)
│   │       ├── useFileTree.ts  # Directory tree (15s poll)
│   │       └── useFile.ts      # Single file content
│   │
│   ├── middleware.ts           # Session check, redirect to /login
│   └── types/
│       └── index.ts            # Directive, AgentStatus, FileNode, etc.
│
└── __tests__/
    ├── directives.test.ts
    ├── auth.test.ts
    ├── file-viewer.test.ts
    └── components/
        ├── DirectiveForm.test.tsx
        ├── DirectiveList.test.tsx
        └── FileTree.test.tsx
```

---

## Authentication

### Flow

```
Login page                        Next.js API route
  │                                /api/auth/login
  │  POST { username, password }       │
  ├──────────────────────────────────>│
  │                                    │ Validate against
  │                                    │ /state/dashboard-users.json
  │                                    │ (bcrypt-hashed passwords)
  │   Set-Cookie: session (encrypted)  │
  │<──────────────────────────────────┤
  │                                    │ iron-session
  v

Subsequent page loads
  │
  │  Cookie: session ──> middleware.ts
  │                       │
  │                  Valid? ──> render page
  │                  Invalid? ──> 302 /login

API calls to Express
  │
  │  lib/api.ts adds Authorization: Bearer <DASHBOARD_TOKEN>
  │  Token lives server-side only, never sent to browser
  │  ──> Express :3000
```

### Implementation

- **Credential storage:** `/state/dashboard-users.json` — `{ "username": "$bcrypt_hash" }` map
- **Session library:** `iron-session` — encrypted + signed cookies, no database
- **Session contents:** `{ username, loggedInAt }` — nothing sensitive
- **User management CLI:**
  - `npm run create-user` — prompts for username + password
  - `npm run delete-user` — removes a user
- **Express token:** `DASHBOARD_TOKEN` env var, attached server-side by `lib/api.ts` or `next.config.js` proxy rewrites. The browser never sees it.

---

## Directives (Agent Steering)

### Directive types

Directives fall into three categories. The `type` field tells the agent
what to do with each one.

| Type | Example | Agent behavior |
|------|---------|---------------|
| **task** | "Add CORS headers to Express" | Adds to `dev-objectives.json` as a work item. Completes it, marks done. |
| **focus** | "Drop everything, focus on testing" | Rewrites `dev-phase.json`, reorders `dev-objectives.json`. Suspends current work. |
| **policy** | "Always run tests before committing" | Appends to `/state/agent-policies.json`. Applied as a standing constraint on every future invocation until revoked. |

### Schema

```json
{
  "id": "dir-1740500000-a1b2c3",
  "text": "Focus entirely on the literature review library",
  "type": "focus",
  "priority": "urgent",
  "status": "pending",
  "created_at": "2026-02-25T14:30:00Z",
  "acknowledged_at": null,
  "completed_at": null,
  "agent_notes": null
}
```

- **id:** `dir-<unix_timestamp_ms>-<6_random_hex_chars>`
- **type:** `task` | `focus` | `policy`
- **priority:** `urgent` | `normal` | `background`
- **status:** `pending` | `acknowledged` | `completed` | `deferred` | `dismissed`

### API endpoints (added to Express `server.js`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/directives` | Create. Body: `{ text, type, priority }`. Returns created directive with `id` and `created_at`. |
| `GET` | `/api/directives` | List all. Optional `?status=pending` filter. Sorted by `created_at` descending. |
| `PATCH` | `/api/directives/:id` | Update fields: `text`, `type`, `priority`, `status`, `agent_notes`. |
| `DELETE` | `/api/directives/:id` | Remove permanently. 404 if not found. |

### Validation

- **text:** required, 1-2000 chars, trimmed, reject whitespace-only
- **type:** required, one of `task`, `focus`, `policy`
- **priority:** required, one of `urgent`, `normal`, `background`
- **status transitions:** `pending → acknowledged → completed|deferred`, `pending → dismissed`. No backwards transitions.
- **Body size limit:** 10KB
- **Sanitization:** Never render directive text as raw HTML. Always use `textContent` or equivalent.

### Storage

File: `/state/directives.json` — flat JSON array.

Concurrency safety via atomic writes:
```javascript
// Server-side (Node.js)
const tmp = filePath + '.tmp.' + process.pid;
fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
fs.renameSync(tmp, filePath);
```
```python
# Agent-side (Python)
import tempfile, os, json
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(file_path))
with os.fdopen(fd, 'w') as f:
    json.dump(data, f, indent=2)
os.rename(tmp, file_path)
```

### Directive lifecycle

```
User submits via dashboard UI
  │
  v
Express writes to /state/directives.json (status: "pending")
  │
  v
Agent starts next invocation
  ├─ Reads directives.json
  ├─ type: task   → adds to dev-objectives.json
  ├─ type: focus  → rewrites dev-phase.json, reorders objectives
  ├─ type: policy → appends to /state/agent-policies.json
  ├─ Sets status: "acknowledged", writes acknowledged_at
  │
  v
Dashboard polls, user sees "acknowledged" badge (blue)
Toast notification: "Directive acknowledged by agent"
  │
  v
Agent completes/defers the directive
  ├─ Sets status: "completed" or "deferred"
  ├─ Writes agent_notes explaining what it did
  │
  v
Dashboard polls, user sees "completed" badge (green)
Agent's explanation shown under the directive
```

### UI

```
┌─────────────────────────────────────────────┐
│  Submit Directive                            │
│  ┌────────────────────────────────────────┐  │
│  │ What should the agent do?              │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│  Type:     [ Task ] [ Focus ] [ Policy ]     │
│  Priority: [Urgent] [Normal] [Background]    │
│                                   [Submit]   │
├─────────────────────────────────────────────┤
│  Pending (2)                                 │
│  ┌─────────────────────────────────────┐     │
│  │ ● pending  "Focus on lit review"    │     │
│  │ focus · urgent · 2 min ago  [Delete]│     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │ ● acknowledged  "Skip CLI framework"│     │
│  │ task · normal · 12 min ago          │     │
│  │ Agent: "Deprioritized CLI in        │     │
│  │ dev-objectives.json"                │     │
│  └─────────────────────────────────────┘     │
├─────────────────────────────────────────────┤
│  Completed (7)                    [Show v]   │
│  └─ (collapsed, expandable)                  │
└─────────────────────────────────────────────┘
```

Status badge colors: pending (orange), acknowledged (blue), completed
(green), deferred (gray), dismissed (red).

Delete button only on pending directives.

---

## File Viewer

### Route

`/files/[[...path]]` — catch-all route mapping URL segments to
filesystem paths.

### URL-to-filesystem mapping

| URL prefix | Filesystem path | Description |
|------------|----------------|-------------|
| `/files/output/...` | `/output/...` | Research reports |
| `/files/state/...` | `/state/...` | Agent state files |
| `/files/tools/...` | `/tools/...` | Tool source code |
| `/files/agent/...` | `/agent/...` | Agent config, CLAUDE.md |
| `/files/logs/...` | `/var/log/agent/...` | Invocation logs |

`/files` with no path shows a root picker listing all five directories.

### Layout

```
┌──────────────────────────────────────────────────┐
│  Breadcrumb: tools / climate-trends / analyze.py │
├──────────────┬───────────────────────────────────┤
│  File Tree   │  File Content                     │
│              │                                   │
│  tools/      │  analyze.py                       │
│   climate-/  │  /tools/climate-trends/analyze.py │
│    analysis/ │  4.2 KB · Modified 2h ago         │
│    open_.../  │                                   │
│    analyze ◀ │  (syntax-highlighted Python)      │
│    collect   │                                   │
│   covid-/    │                                   │
│   currency-/ │                                   │
└──────────────┴───────────────────────────────────┘
```

### Components

- **FileTree** — Recursive collapsible tree. Lazy-loads subdirectories
  on expand via `/api/file?path=<dir>`. Highlights currently viewed file.
- **FileViewer** — Renders content by file type:
  - `.md` → Rendered Markdown
  - `.py`, `.js`, `.ts`, `.json`, `.toml`, `.sh` → Syntax-highlighted code (shiki or highlight.js)
  - `.log`, `.txt` → Monospace plain text
  - Files >100KB → Truncation notice with option to load full content
- **Breadcrumb** — Clickable path segments for navigation

### Server-side changes

Add to `walkDir` skip list in Express `server.js`:
- `data/` (1.5GB cached API responses)
- `.venv/` (Python virtual environment)
- Already skipped: `node_modules/`, `backups/`

---

## Main Dashboard Page

The root page (`/`) after login.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Header                                                   │
│  Agent Dashboard    Status: ● Running    [Disable]        │
│  Phase: Shared Library Extraction   Invocations: 47       │
│  Stalls: 0   Active Objectives: 3   Disk: 62%            │
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │  Live Invocation Output                       │
│          │                                                │
│ Links:   │  ┌─ system ────────────────────────────────┐  │
│ Dashboard│  │ Model: claude-opus-4  Session: abc123   │  │
│ Directives│ └─────────────────────────────────────────┘  │
│ Files    │                                                │
│ Logs     │  ┌─ tool-use (Read) ───────────────────────┐  │
│          │  │ /tools/lib/formatting.py                 │  │
│ ──────── │  └─────────────────────────────────────────┘  │
│ Pending  │                                                │
│ directives│ ┌─ text ──────────────────────────────────┐  │
│ (3 max)  │  │ Extracting fmt() helper...              │  │
│          │  └─────────────────────────────────────────┘  │
│ ──────── │                                                │
│ Quick    │  ┌─ result ────────────────────────────────┐  │
│ links:   │  │ Done  Turns: 8  Duration: 3m 42s        │  │
│ Journal  │  └─────────────────────────────────────────┘  │
│ Objectives│                                               │
│ CLAUDE.md │                                               │
└──────────┴───────────────────────────────────────────────┘
```

### Behavior

- **Header:** Tremor KPI cards for status, phase, invocations, stalls,
  objectives, disk usage
- **Sidebar:** Nav links, up to 3 pending directives as compact inline
  cards, quick links to journal/objectives/CLAUDE.md (open in file viewer)
- **Main area:** Live invocation event stream. Color-coded collapsible
  event cards (system=blue, text=green, tool-use=yellow, error=red).
  Auto-scrolls to bottom, pauses when user scrolls up.
- **Idle state:** When agent is idle, shows most recent completed
  invocation output.

### Polling intervals

| Data | Interval | Hook |
|------|----------|------|
| Agent status / KPIs | 5 seconds | `useStatus` |
| Live invocation output | 2 seconds | `useLive` |
| Directive count (sidebar) | 5 seconds | `useDirectives` |

---

## V1 Scope

### Included

- Login page with session auth (username/password, iron-session cookie)
- User management CLI (`npm run create-user`, `npm run delete-user`)
- Main dashboard page (status KPIs, live event stream, agent toggle)
- Directives page (submit form, directive list, status polling, toasts)
- File viewer (all 5 directories, syntax highlighting, lazy tree)
- Sidebar with nav, pending directives, quick links
- Directive CRUD endpoints added to Express `server.js`
- `walkDir` skip list updates (data/, .venv/)
- Firewall rule to open port 3001
- Full test suite

### Deferred (V2)

- 14 tool data pages (1-2 built in V1 as a template, rest in V2)
- Migration of Express API routes into Next.js
- Decommission of old dashboard on port 3000
- SSE or WebSocket upgrade for real-time data

---

## Testing

All tests must pass before any code is deployed.

### Infrastructure

- Jest + supertest in devDependencies
- React Testing Library for component tests
- `npm test` runs full suite
- `__tests__/` directory at project root

### Required coverage

**API tests** (`directives.test.ts`):
- POST creates directive, returns ID, persists to disk
- POST rejects empty text, invalid type, invalid priority, oversized body
- GET returns all directives
- GET with `?status=pending` filters correctly
- PATCH updates fields, rejects invalid status transitions, 404 for missing ID
- DELETE removes directive, 404 for missing ID
- All endpoints return 401 without auth token

**Concurrency tests** (`directives-concurrency.test.ts`):
- Simultaneous writes don't corrupt directives.json
- Read during write returns valid (possibly stale) state

**Auth tests** (`auth.test.ts`):
- Login with valid credentials returns session cookie
- Login with invalid credentials returns 401
- Protected pages redirect to /login without session
- Logout destroys session
- create-user script creates valid bcrypt hash

**File viewer tests** (`file-viewer.test.ts`):
- `/api/file?path=/tools/` returns directory listing
- `/api/file?path=/agent/CLAUDE.md` returns file contents
- `/api/file?path=/etc/passwd` is rejected (outside allowed dirs)
- Symlinks outside allowed directories are rejected
- `walkDir` skips `data/`, `.venv/`, `node_modules/`, `backups/`

**Component tests** (`components/*.test.tsx`):
- DirectiveForm validates inputs, calls submit handler
- DirectiveList renders directives grouped by status
- FileTree renders tree structure, handles expand/collapse
- StatusBadge renders correct color for each status

**Security tests** (`directives-security.test.ts`):
- Directive text with `<script>` tags is escaped in rendered output
- Directive text with shell metacharacters is stored literally
- Oversized bodies (>10KB) are rejected
- Malformed JSON returns 400

---

## Tech Stack Summary

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
| Data layer | Existing Express server on :3000 |
| Deployment | Port 3001, firewall opened |
