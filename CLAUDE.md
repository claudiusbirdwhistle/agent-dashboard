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
| `/agent/edgar-sentinel` | The codebase of your current primary project. |
| `/agent/dashboard-next/` | Next.js dashboard (port 3001) |
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

**`/state/blocked-tasks.json`** — Tracks objectives blocked on background tasks.

```json
[
  {
    "task_id": "ingest-chunk-5",
    "objective_id": "backtest-batch-ingest",
    "command": "python3 /tools/backtest-batch-runner.py ingest --chunk-size 100",
    "blocked_at": "2026-02-27T20:30:00Z"
  }
]
```

When empty (`[]`), no objectives are blocked. See **Blocked Objectives**
below for the full workflow.

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
   - `/state/blocked-tasks.json`

   Do NOT read these sequentially — issue all Read calls in one turn.
   Do NOT read `/state/agent-policies.json` unless a `policy` directive
   references it (the file may not exist).
   The `active` field in objectives tells you where the previous invocation
   left off. `next_prompt.txt` tells you what to do next, or what to retry
   if the previous invocation crashed.

1b. **Check blocked tasks** — If `/state/blocked-tasks.json` is non-empty,
   run `python3 /tools/bg-task-check.py check` to see if any background
   tasks have completed. This may unblock objectives. If the active
   objective was blocked and is now unblocked, resume it. If still blocked,
   pick the next unblocked objective to work on.

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

You have ~60 max turns. The supervisor will cut you off without warning.

| Checkpoint | Action |
|------------|--------|
| Turn 1 | Read all state (parallel — **one tool call, 5 files**). |
| Turn 2 | Claim work: write `next_prompt.txt` + update `dev-objectives.json`. |
| Turn 3 | TodoWrite task list. Begin work. |
| Turns 4–18 | First phase of implementation. |
| **Turn 20** | **EARLY STATE CHECKPOINT.** Write `next_prompt.txt` with progress. |
| Turns 21–40 | Continue implementation. |
| **Turn 42** | **MANDATORY PRE-WRAP STATE WRITE.** Write `next_prompt.txt` AND `dev-objectives.json`. |
| Turns 43–50 | Verify, commit, push. |
| Turns 51–56 | Final state writes: `next_prompt.txt`, `dev-objectives.json`, `health.json`, directives. |
| Turns 57–60 | Buffer for error recovery. |

### State Write Insurance

**Every invocation must write `next_prompt.txt` at least 3 times:**

1. **Claim** (turn 1–2): `"Currently working on: <id> — <context>. If crashed, retry from here."`
2. **Progress** (turn 20): `"Working on: <id>. Done so far: <X>. Remaining: <Y>. Key files: <paths>. If crashed, resume from <specific step>."`
3. **Completion** (turn 40+): Full rich breadcrumb with everything the next invocation needs.

**Why 3 writes?** The supervisor has post-invocation recovery that parses
the log, but it can only extract tool calls and git state — not your
reasoning, decisions, or plan. Only YOU can write the "why" and "what next."
The recovery script (`state-recovery.sh`) is a safety net, not a substitute
for proper breadcrumbs.

**The progress write at turn 8 is your highest-ROI action.** It costs ~30
seconds but prevents 3–5 minutes of re-discovery if the invocation is cut
off. Think of it as saving your game.

A half-finished feature with updated state is far more valuable than a
finished feature the next invocation can't find.

### Stall Thresholds

- 3 consecutive stalls (no commit): change approach.
- 5 consecutive stalls: pick a different objective.
- 8 consecutive stalls: write `disabled` to `/state/agent_enabled`.

### Turn Efficiency Rules

- **No text-only turns.** Combine reasoning with tool calls in the same
  turn. If you know what tool call comes next, include it — do not narrate
  first and act second.
- **TodoWrite: max 2 calls per invocation.** Once to create the initial
  task list (turn 3), once to mark final completion. Do not use TodoWrite
  for intermediate status updates — it wastes a turn each time.
- **Batch independent reads.** When you need to read multiple unrelated
  files, issue all Read calls in one parallel batch, not sequentially.

### State Safety

- Atomic writes: write to a temp file, then rename into place.
- If `dev-objectives.json` is missing, reconstruct from `next_prompt.txt`
  and the git log.

---

## Blocked Objectives (Background Task Model)

When a task requires a long-running process (data ingestion, batch analysis,
model training, etc.), **do not wait for it**. Instead:

### Launching a Background Task

```bash
python3 /tools/bg-task-check.py launch <task-id> <objective-id> <command...>
```

This will:
1. Run `<command>` in a **detached process group** (survives invocation kill)
2. Register the task in `/state/blocked-tasks.json`
3. Set the linked objective's status to `"blocked"` in `dev-objectives.json`

The task's output goes to `/state/bg-tasks/<task-id>.log`. A `.status` JSON
file appears when the task completes.

### Checking Blocked Tasks

At each invocation start (step 1b in The Sequence):

```bash
python3 /tools/bg-task-check.py check
```

This checks all blocked tasks and unblocks completed ones. If the active
objective was blocked and is now unblocked, resume it. If it's still
blocked, work on the next unblocked objective.

To see detailed status without modifying state:

```bash
python3 /tools/bg-task-check.py status
```

### Workflow Example

1. You need to ingest 500 tickers (takes ~30 min).
2. Launch: `python3 /tools/bg-task-check.py launch ingest-run backtest-batch-ingest python3 /tools/backtest-batch-runner.py ingest --chunk-size 500`
3. Objective `backtest-batch-ingest` is now `"blocked"`.
4. Switch `active` to the next unblocked objective (e.g., mobile UI task).
5. Work on that objective for this invocation.
6. Next invocation: `bg-task-check.py check` finds ingestion complete → unblocks objective → resume.

### Key Rules

- **Never wait** for a long-running command within the invocation. Launch it
  in the background and block the objective.
- **One background task per objective.** If you need multiple steps, chain
  them in the command or use a wrapper script.
- A `"blocked"` objective is **not idle** — it has work running. Do not
  disable the agent if blocked objectives exist.
- Background tasks survive invocation termination because they run in a
  separate process group via `setsid`.

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

Before self-disabling, check **both** of these:

1. **No actionable directives** — no directive in `/state/directives.json`
   has `status: "pending"` or `status: "acknowledged"` (i.e., not yet
   `completed`/`dismissed`/`deferred`).
2. **No pending work items** — no item in `/state/dev-objectives.json` has
   `status: "pending"` or `status: "active"`.
3. **No blocked tasks** — `/state/blocked-tasks.json` is empty (`[]`).
   Blocked objectives have background work running and need the agent to
   check back and resume when complete.

**Only if ALL conditions are true**, write `"disabled"` to
`/state/agent_enabled` and stop. Do not invent new work — wait for the
operator to send a new directive.

**If either condition is false, keep working.** Pending objectives count as
work regardless of who created them (operator or agent) and regardless of
priority (urgent, normal, or background). Background-priority items are
real work — do them when nothing higher-priority remains.

---

## Principals

- **Never merge `dev` into `main`.** That requires human review.
- **Never break the old dashboard** (port 3000).
- **Never commit secrets** (`.env.local`, tokens, credentials).
- **One unit of work per invocation.** Scope creep causes stalls.
- **When modifying the front end, always restart the server after you complete your changes.** If you fail to restart the server, the user will not see your changes.
