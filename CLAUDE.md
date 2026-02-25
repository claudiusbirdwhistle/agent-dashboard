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
| `/var/log/agent/` | Invocation logs (raw stream-json) |
| `/var/log/agent/transcripts/` | Readable markdown transcripts (latest 5, auto-rotated) |

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
- **End:** Rich breadcrumb with enough context for the next invocation to
  resume without re-reading already-comprehended files:
  `"Completed: <what>. Next: <id> — <first action>. Context: <key facts, file paths, structural notes>."`

The supervisor feeds this verbatim to the next invocation. **Include enough
detail that the next invocation can skip exploratory reads** — file paths,
key structural decisions, what was verified, what remains.

---

## Invocation Discipline

Follow this sequence at the start of every invocation.

### The Sequence

1. **Read state (parallel)** — Read ALL state files in a **single parallel
   tool call batch** to minimize turn overhead:
   - `/state/dev-objectives.json`
   - `/state/next_prompt.txt`
   - `/state/directives.json`
   - `/state/skills/index.json`
   - `/state/health.json`

   Do NOT read these sequentially — issue all Read calls in one turn.
   Do NOT read `/state/agent-policies.json` unless a `policy` directive
   references it (the file may not exist).
   The `active` field in objectives tells you where the previous invocation
   left off. `next_prompt.txt` tells you what to do next, or what to retry
   if the previous invocation crashed.

2. **Handle pending directives** — Process any `pending` directives in
   `/state/directives.json` before starting other work. Acknowledge each one
   (set `status: "acknowledged"`, `acknowledged_at: <now>`). Handle `urgent`
   directives immediately; queue `normal` and `background` per their priority.
   See the Directives section for the full directive handling rules.

3. **Claim the work (within first 2 turns after reads)** — Overwrite
   `next_prompt.txt` with:
   `"Currently working on: <id> — <one-line context>. If crashed, retry from here."`
   Update `active.notes` in `dev-objectives.json`. Do this immediately
   after state reads — before any exploration or code reads.

4. **Create a task list** — Use the TodoWrite tool to create a checklist for
   this invocation. Final two items must always be:
   - `Update dev-objectives.json (active + status)`
   - `Update next_prompt.txt (completion)`
   Keep the list to 3–5 items so it fits within the turn budget.

5. **Do one unit of work** — One component, one endpoint, one test suite.
   Not the whole feature. Not two features.

6. **Verify** — Run tests. Confirm nothing regressed.

7. **Commit** — Atomic git commit with a conventional message.

8. **Update state** — Complete the final two todo items:
   - In `dev-objectives.json`: mark objective `completed` if done; move
     `active` to next unblocked item with fresh `notes`.
   - Overwrite `next_prompt.txt` with a **rich breadcrumb**:
     `"Completed: <what>. Next: <id> — <exact first action>. Context: <files read, key facts, what's verified>."`
     Include enough detail to prevent the next invocation from re-reading
     the same files or re-discovering the same facts.

### Turn Budget

**Hard rule: stop implementation work by turn 15.** Use remaining turns
for verification, committing, and step 8. A half-finished feature with
updated state is far more valuable than a finished feature the next
invocation can't find.

### Stall Thresholds

- 3 consecutive stalls (no commit): change approach.
- 5 consecutive stalls: pick a different objective.
- 8 consecutive stalls: write `disabled` to `/state/agent_enabled`.

### State Safety

- Atomic writes: write to a temp file, then rename into place.
- If `dev-objectives.json` is missing, reconstruct from `next_prompt.txt`
  and the git log.

---

## Skills

Additional skills are loaded on demand by reading files from
`/state/skills/`. Use the `Read` tool (not the `Skill` tool) to load them.

**Index:** `/state/skills/index.json`

| ID | Load when |
|----|-----------|
| `git-workflow` | Before any commit, branch, or merge |
| `tdd` | Before implementing any new feature |
| `dashboard-next` | When working on `/agent/dashboard-next/` or Express API |

To load a skill: `Read` the file `/state/skills/<id>.md`.

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

## Idle Policy

**If there are no pending or active directives and no pending work items in `dev-objectives.json`, write `"disabled"` to `/state/agent_enabled` and stop.** Do not invent work. Wait for the operator to send a new directive.

---

## Principals

- **Never merge `dev` into `main`.** That requires human review.
- **Never break the old dashboard** (port 3000).
- **Never commit secrets** (`.env.local`, tokens, credentials).
- **One unit of work per invocation.** Scope creep causes stalls.
