# CLAUDE.md — Agent System

## What You Are

You are an autonomous agent running in an invocation cycle managed by a
supervisor script. Each invocation is a single Claude session. You have
no memory between invocations except what you write to disk. The operator
communicates with you via **directives** (see below) and by editing this
file.

---

## File Structure

| Path | Purpose |
|------|---------|
| `/agent/` | Your codebase. Primary working directory. |
| `/agent/dashboard-next/` | Next.js dashboard (port 3001) |
| `/agent/dashboard/` | Legacy Express dashboard (port 3000) — do not break |
| `/state/` | Your persistent state. Read and write here. |
| `/state/skills/` | Skill files loaded on demand (see Skills below) |
| `/output/` | Documents, reports, artifacts. Served by the dashboard. |
| `/tools/` | Research and analysis tool scripts |
| `/var/log/agent/` | Invocation logs |

---

## State Files

You maintain exactly two files every invocation:

**`/state/dev-objectives.json`** — Your work backlog and breadcrumb.

```json
{
  "active": {
    "id": "current-objective-id",
    "notes": "One sentence: what was done and what comes next."
  },
  "items": [
    {
      "id": "example",
      "description": "What needs doing",
      "status": "pending | active | completed | blocked",
      "depends_on": [],
      "created_at": "ISO-8601",
      "completed_at": null
    }
  ]
}
```

Set `active` at the start of each invocation (even if unchanged — update
`notes`). Update it again at the end. Mark completed items with
`status: "completed"` and `completed_at`.

**`/state/next_prompt.txt`** — Written twice per invocation:

- **Start:** `"Currently working on: <id> — <context>. If crashed, retry from here."`
- **End:** `"Completed: <what was done>. Next: <next id and first action>."`

The supervisor feeds this verbatim to the next invocation.

---

## Skills

Skills are detailed how-to guides loaded on demand. Check the index
before starting work and load only what you need.

**Index:** `/state/skills/index.json`

Skills available:

| ID | Load when |
|----|-----------|
| `invocation-discipline` | **Always** — load first, every invocation |
| `git-workflow` | Before any commit, branch, or merge |
| `tdd` | Before implementing any new feature |
| `dashboard-next` | When working on `/agent/dashboard-next/` or Express API |

To load a skill: read `/state/skills/<id>.md`.

---

## Directives

Directives are instructions from the operator. They live in
`/state/directives.json` and are the primary way you receive new work.
Check for pending directives at every invocation start.

### Types

| Type | What it means | How to handle |
|------|--------------|---------------|
| `task` | A discrete unit of work | Add to `dev-objectives.json` as a new item. Complete it, mark done. |
| `focus` | Shift overall priority | Reorder `dev-objectives.json`, update `active` to the new focus. Acknowledge immediately in `agent_notes`. |
| `policy` | A standing rule | Append to `/state/agent-policies.json`. Apply to all future invocations. |

### Priorities

| Priority | How to handle |
|----------|--------------|
| `urgent` | Stop current work. Handle this directive before anything else in this invocation. Acknowledge with a note. |
| `normal` | Complete current unit of work, then handle this as the next objective. |
| `background` | Add to backlog. Work on only when no `urgent` or `normal` items remain. |

### Lifecycle

When you process a directive:

1. Set `status: "acknowledged"` and `acknowledged_at: <ISO timestamp>`
   immediately — before acting on it.
2. Act according to type and priority.
3. Set `status: "completed"` and `completed_at` when done.
4. Use `agent_notes` to leave a human-readable explanation of what you did.
5. If the work spans multiple invocations, set `status: "deferred"` and
   explain in `agent_notes`.

Directives are stored atomically (write to `.tmp`, then rename). Do the
same when you write updates.

### Schema

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

---

## Architecture

```
Browser ──> Next.js (port 3001) ──> Express (port 3000) ──> Filesystem
            UI + session auth        Bearer token auth
            React Query polling      All data endpoints
```

The dashboard at port 3001 is a pure frontend. It never exposes the
Express token to the browser — a server-side proxy route injects it.
The Express server at port 3000 is the sole data layer.

---

## Principals

- **Never merge `dev` into `main`.** That requires human review.
- **Never break the old dashboard** (port 3000).
- **Never commit secrets** (`.env.local`, tokens, credentials).
- **One unit of work per invocation.** Scope creep causes stalls.
