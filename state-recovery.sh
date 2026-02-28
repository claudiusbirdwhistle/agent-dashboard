#!/usr/bin/env bash
# ============================================================================
# state-recovery.sh — Enhanced post-invocation state recovery
# ============================================================================
# Called by invoke.sh when next_prompt.txt was not updated during an
# invocation. Parses the invocation log to extract what actually happened,
# producing a rich recovery breadcrumb so the next invocation doesn't
# waste turns re-discovering context.
#
# Usage: state-recovery.sh <invocation_log> <state_dir> <agent_dir>
# ============================================================================

set -euo pipefail

LOG_FILE="${1:?Usage: state-recovery.sh <log_file> <state_dir> <agent_dir>}"
STATE_DIR="${2:?}"
AGENT_DIR="${3:?}"

python3 - "${LOG_FILE}" "${STATE_DIR}" "${AGENT_DIR}" << 'PYEOF'
import json
import sys
import os
import subprocess

log_file = sys.argv[1]
state_dir = sys.argv[2]
agent_dir = sys.argv[3]

# --- Parse dev-tasks.json for baseline context ---
active_id = "unknown"
active_notes = "none"
current_directive_id = None
try:
    with open(os.path.join(state_dir, "dev-tasks.json")) as f:
        obj = json.load(f)
        active = obj.get("active", {})
        active_id = active.get("id", "unknown")
        active_notes = active.get("notes", "none")
        current_directive_id = active.get("current_directive_id")
except Exception:
    pass

# --- Parse directive text for context ---
directive_text = None
if current_directive_id:
    try:
        with open(os.path.join(state_dir, "directives.json")) as f:
            directives = json.load(f)
            for d in directives:
                if d.get("id") == current_directive_id:
                    directive_text = d.get("text", "")[:200]
                    break
    except Exception:
        pass

# --- Parse invocation log for tool calls and actions ---
files_written = []
files_edited = []
files_read = []
bash_commands = []
git_commits = []
last_assistant_text = ""
todo_items = []
turn_count = 0

try:
    with open(log_file, "r") as f:
        for raw_line in f:
            raw_line = raw_line.strip()
            if not raw_line or raw_line.startswith("===") or raw_line.startswith("Prompt:") or raw_line == "---":
                continue
            try:
                event = json.loads(raw_line)
            except json.JSONDecodeError:
                continue

            etype = event.get("type")

            if etype == "assistant":
                turn_count += 1
                msg = event.get("message", {})
                for block in msg.get("content", []):
                    if block.get("type") == "text":
                        text = block.get("text", "").strip()
                        if text:
                            last_assistant_text = text

                    elif block.get("type") == "tool_use":
                        name = block.get("name", "")
                        inp = block.get("input", {})

                        if name == "Write":
                            path = inp.get("file_path", "")
                            if path and "/state/" not in path:
                                files_written.append(path)

                        elif name == "Edit":
                            path = inp.get("file_path", "")
                            if path and "/state/" not in path:
                                files_edited.append(path)

                        elif name == "Read":
                            path = inp.get("file_path", "")
                            if path:
                                files_read.append(path)

                        elif name == "Bash":
                            cmd = inp.get("command", "")
                            if cmd:
                                bash_commands.append(cmd[:150])
                                # Detect git commits
                                if "git commit" in cmd:
                                    git_commits.append(cmd[:150])

                        elif name == "TodoWrite":
                            todos = inp.get("todos", [])
                            todo_items = [
                                f"  - [{t.get('status', '?')}] {t.get('content', '?')}"
                                for t in todos
                            ]

            elif etype == "result":
                result_turns = event.get("num_turns")
                if result_turns:
                    turn_count = result_turns

except Exception as e:
    pass

# --- Get git state ---
last_commit = "unknown"
uncommitted = "none"
try:
    result = subprocess.run(
        ["git", "-C", agent_dir, "log", "--oneline", "-3"],
        capture_output=True, text=True, timeout=5
    )
    if result.returncode == 0:
        last_commit = result.stdout.strip()
except Exception:
    pass

try:
    result = subprocess.run(
        ["git", "-C", agent_dir, "diff", "--name-only"],
        capture_output=True, text=True, timeout=5
    )
    if result.returncode == 0 and result.stdout.strip():
        uncommitted = result.stdout.strip()
except Exception:
    pass

# --- Deduplicate file lists ---
files_written = list(dict.fromkeys(files_written))
files_edited = list(dict.fromkeys(files_edited))
# Only keep reads that aren't state files and weren't also written/edited
state_paths = {"/state/dev-tasks.json", "/state/next_prompt.txt",
               "/state/directives.json", "/state/health.json",
               "/state/skills/index.json"}
files_read = [f for f in dict.fromkeys(files_read)
              if f not in state_paths and f not in files_written and f not in files_edited]

# --- Build recovery breadcrumb ---
lines = []
lines.append("WARNING: Previous invocation ended without updating state (crashed or hit max-turns).")
lines.append(f"Turns used: ~{turn_count}")
lines.append("")

lines.append(f"Active task: {active_id}")
lines.append(f"Last known notes: {active_notes}")
if directive_text:
    lines.append(f"Directive text: {directive_text}")
lines.append("")

if files_written or files_edited:
    lines.append("Files modified during invocation:")
    for f in files_written:
        lines.append(f"  - CREATED: {f}")
    for f in files_edited:
        lines.append(f"  - EDITED: {f}")
    lines.append("")

if files_read[:10]:
    lines.append("Key files read (non-state):")
    for f in files_read[:10]:
        lines.append(f"  - {f}")
    lines.append("")

if git_commits:
    lines.append("Git commits attempted:")
    for c in git_commits:
        lines.append(f"  - {c}")
    lines.append("")

lines.append(f"Last 3 commits: {last_commit}")
if uncommitted != "none":
    lines.append(f"Uncommitted changes: {uncommitted}")
lines.append("")

if todo_items:
    lines.append("Last known task list:")
    lines.extend(todo_items)
    lines.append("")

# Truncate last assistant text for context
if last_assistant_text:
    truncated = last_assistant_text[:300]
    if len(last_assistant_text) > 300:
        truncated += "..."
    lines.append(f"Last assistant output: {truncated}")
    lines.append("")

lines.append("Action: Read dev-tasks.json, check git log/diff for partial work, and resume.")
lines.append("IMPORTANT: Write state EARLY this invocation. Do mid-invocation save by turn 12.")

# --- Write atomically ---
output = "\n".join(lines) + "\n"
tmp_path = os.path.join(state_dir, "next_prompt.txt.tmp")
final_path = os.path.join(state_dir, "next_prompt.txt")
with open(tmp_path, "w") as f:
    f.write(output)
os.rename(tmp_path, final_path)

print(f"Recovery breadcrumb written ({len(lines)} lines, {turn_count} turns parsed)")
PYEOF
