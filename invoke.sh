#!/usr/bin/env bash
# ============================================================================
# invoke.sh — Single invocation of the autonomous research agent
# ============================================================================
# Checks the enable/disable flag before running. Uses flock to prevent
# duplicate concurrent instances. Scheduling is handled by the external
# supervisor (supervisor.sh) — this script does NOT schedule its successor.
# ============================================================================

set -euo pipefail

AGENT_DIR="/agent"
STATE_DIR="/state"
TOOLS_DIR="/tools"
OUTPUT_DIR="/output"
LOG_DIR="/var/log/agent"
RUN_DIR="/agent/.run"
LOCK_FILE="${RUN_DIR}/invoke.lock"
PID_FILE="${RUN_DIR}/invoke.pid"

mkdir -p "${RUN_DIR}"

# ── Acquire exclusive lock (non-blocking) ────────────────────────────────
# Prevents duplicate concurrent instances when invoked directly.
# When called by supervisor.sh, AGENT_SUPERVISED is set and the supervisor
# already holds the lock — skip to avoid deadlocking against ourselves.

if [[ -z "${AGENT_SUPERVISED:-}" ]]; then
    exec 9>"${LOCK_FILE}"
    if ! flock --nonblock 9; then
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Another invocation is already running (lock held). Exiting." >> "${LOG_DIR}/daemon.log"
        exit 0
    fi
fi

# ── Write PID file and set up cleanup trap ───────────────────────────────

echo $$ > "${PID_FILE}"

cleanup() {
    rm -f "${PID_FILE}"
    rm -f "${LOG_DIR}/current.log"
}
trap cleanup EXIT

# ── Check enable/disable flag ──────────────────────────────────────────────

ENABLED_FLAG="${STATE_DIR}/agent_enabled"
if [[ -f "${ENABLED_FLAG}" ]]; then
    STATUS=$(cat "${ENABLED_FLAG}" | tr -d '[:space:]')
    if [[ "${STATUS}" != "enabled" ]]; then
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Agent is DISABLED. Exiting without invocation." >> "${LOG_DIR}/daemon.log"
        exit 0
    fi
fi

# ── Load config ─────────────────────────────────────────────────────────

if [[ -f "${AGENT_DIR}/agent.env" ]]; then
    set -a
    source "${AGENT_DIR}/agent.env"
    set +a
fi

MAX_TURNS="${AGENT_MAX_TURNS:-60}"

# ── Auto model selection ──────────────────────────────────────────────────
# When AGENT_AUTO_MODEL=true, let select-model.js pick based on task complexity.
# Falls back to AGENT_MODEL on error or when disabled.

if [[ "${AGENT_AUTO_MODEL:-}" == "true" ]]; then
    AUTO_MODEL=$(node "${AGENT_DIR}/select-model.js" \
        ${AGENT_MIN_MODEL:+--minimum "${AGENT_MIN_MODEL}"} \
        2>>"${LOG_DIR}/daemon.log") || true
    if [[ -n "${AUTO_MODEL}" ]]; then
        MODEL="${AUTO_MODEL}"
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Auto-model selected: ${MODEL}" >> "${LOG_DIR}/daemon.log"
    else
        MODEL="${AGENT_MODEL:-claude-opus-4-6}"
        echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Auto-model failed, fallback: ${MODEL}" >> "${LOG_DIR}/daemon.log"
    fi
else
    MODEL="${AGENT_MODEL:-claude-opus-4-6}"
fi

# ── Resolve Claude binary ──────────────────────────────────────────────────

CLAUDE_BIN=""
for candidate in \
    "${HOME}/.claude/bin/claude" \
    "${HOME}/.local/bin/claude" \
    "/usr/local/bin/claude"; do
    if [[ -x "${candidate}" ]]; then
        CLAUDE_BIN="${candidate}"
        break
    fi
done

if [[ -z "${CLAUDE_BIN}" ]]; then
    echo "[FATAL] Claude binary not found" >> "${LOG_DIR}/error.log"
    exit 1
fi

# ── Build the prompt ────────────────────────────────────────────────────

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
INVOCATION_START=$(date +%s)
INVOCATION_LOG="${LOG_DIR}/invocation_${TIMESTAMP}.log"

if [[ -f "${STATE_DIR}/next_prompt.txt" ]]; then
    NEXT_PROMPT=$(cat "${STATE_DIR}/next_prompt.txt")
else
    NEXT_PROMPT="This is your first invocation. No state files exist yet. Follow the First Invocation instructions in CLAUDE.md."
fi

PROMPT=$(cat << EOF
${NEXT_PROMPT}

---
Invocation timestamp: ${TIMESTAMP}
Working directory: ${AGENT_DIR}
State directory: ${STATE_DIR}
Tools directory: ${TOOLS_DIR}
Output directory: ${OUTPUT_DIR} (for documents/artifacts you create — these are served via the web dashboard)

Remember: Read CLAUDE.md first. Then read all state files in ${STATE_DIR}/ to orient yourself. Do ONE phase of substantive work, write all state changes, then prepare for the next invocation per the instructions in CLAUDE.md.

TURN BUDGET REMINDER: You have ~${MAX_TURNS} max turns. At turn 20, STOP and write a progress breadcrumb to next_prompt.txt (mid-invocation save). At turn 42, STOP implementation and begin wrap-up. The supervisor will detect if you fail to update state and flag it as a stall.

Scheduling is handled by an external supervisor. Do NOT run nohup, sleep, or any scheduling commands. Your exit responsibilities are:
1. Write /state/next_prompt.txt with context for the next invocation
2. Update /state/health.json with invocation count and stall assessment
To pause the agent loop, write "disabled" to /state/agent_enabled.

IMPORTANT: Any documents, reports, artifacts, or files you want to share or preserve should be written to ${OUTPUT_DIR}/. This directory is served by a web dashboard that your operator can browse. Organize files in subdirectories as you see fit.

IMPORTANT: A web dashboard runs at /agent/dashboard/server.js. You may extend it with new features (API routes, views, visualizations) but you must NEVER remove or break the core functionality: the document browser, file viewer, agent enable/disable toggle, and status display. The dashboard is a Node.js/Express app — read the source before modifying. After modifying, restart it with: sudo systemctl restart agent-dashboard
EOF
)

# ── Execute ─────────────────────────────────────────────────────────────

echo "=== Invocation: ${TIMESTAMP} ===" >> "${INVOCATION_LOG}"
echo "Prompt: ${NEXT_PROMPT}" >> "${INVOCATION_LOG}"
echo "---" >> "${INVOCATION_LOG}"

# Point current.log symlink to this invocation for live monitoring
ln -sf "${INVOCATION_LOG}" "${LOG_DIR}/current.log"

cd "${AGENT_DIR}"

# Prevent "nested session" detection — each invocation is independent
unset CLAUDECODE 2>/dev/null || true

# stdbuf forces line-buffering so the log file updates in real-time
# (without it, pipe buffering delays output by 4-8KB chunks)
stdbuf -oL -eL "${CLAUDE_BIN}" \
    -p "${PROMPT}" \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS}" \
    --model "${MODEL}" \
    --verbose \
    --output-format stream-json \
    2>&1 | stdbuf -oL tee -a "${INVOCATION_LOG}"

EXIT_CODE=$?

echo "" >> "${INVOCATION_LOG}"
echo "=== Exit code: ${EXIT_CODE} ===" >> "${INVOCATION_LOG}"
echo "=== End: $(date -u +"%Y-%m-%dT%H:%M:%SZ") ===" >> "${INVOCATION_LOG}"

# ── Post-invocation state recovery ─────────────────────────────────────
# If the agent failed to update next_prompt.txt, parse the invocation log
# for rich context so the next invocation doesn't waste turns reorienting.

NEXT_PROMPT_MTIME=$(stat -c %Y "${STATE_DIR}/next_prompt.txt" 2>/dev/null || echo 0)
OBJECTIVES_MTIME=$(stat -c %Y "${STATE_DIR}/dev-objectives.json" 2>/dev/null || echo 0)

if [[ "${NEXT_PROMPT_MTIME}" -lt "${INVOCATION_START}" ]]; then
    # next_prompt.txt was NOT updated — use enhanced recovery
    "${AGENT_DIR}/state-recovery.sh" "${INVOCATION_LOG}" "${STATE_DIR}" "${AGENT_DIR}" \
        2>>"${LOG_DIR}/daemon.log" || {
        # Fallback: minimal breadcrumb if recovery script fails
        echo "WARNING: Previous invocation ended without updating state. Check git log and dev-objectives.json." \
            > "${STATE_DIR}/next_prompt.txt"
    }
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] STATE RECOVERY: next_prompt.txt not updated. Enhanced recovery breadcrumb written." >> "${LOG_DIR}/daemon.log"
elif [[ "${OBJECTIVES_MTIME}" -lt "${INVOCATION_START}" ]]; then
    # next_prompt.txt updated but dev-objectives.json wasn't — partial state write
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] PARTIAL STATE: next_prompt.txt updated but dev-objectives.json was not. Agent may have been cut off during wrap-up." >> "${LOG_DIR}/daemon.log"
    # Append a warning to existing next_prompt.txt
    printf '\n\nWARNING: dev-objectives.json was NOT updated last invocation. Verify active objective and status are current before starting work.' \
        >> "${STATE_DIR}/next_prompt.txt"
fi

# ── Post-invocation health update ──────────────────────────────────────
# Track stall count based on whether state was updated.

python3 -c "
import json, os
from datetime import datetime, timezone

health_path = '${STATE_DIR}/health.json'
try:
    with open(health_path) as f:
        health = json.load(f)
except:
    health = {'consecutive_stalls': 0}

next_mtime = os.path.getmtime('${STATE_DIR}/next_prompt.txt')
if next_mtime < ${INVOCATION_START}:
    health['consecutive_stalls'] = health.get('consecutive_stalls', 0) + 1
    if health['consecutive_stalls'] >= 3:
        health['status'] = 'stalled'
    else:
        health['status'] = 'degraded'
    health['note'] = f'Invocation ended without state update ({health[\"consecutive_stalls\"]} consecutive stalls)'
else:
    health['consecutive_stalls'] = 0
    # Keep existing note/status if agent set them

health['last_invocation'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

tmp = health_path + '.tmp'
with open(tmp, 'w') as f:
    json.dump(health, f, indent=2)
os.rename(tmp, health_path)
" 2>>"${LOG_DIR}/daemon.log" || true

# ── Post-invocation idle-policy safety net ─────────────────────────────
# If the agent wrote "disabled" but there are still pending/active items in
# dev-objectives.json or pending directives, auto-re-enable. This prevents
# premature self-disabling when background work remains.

python3 -c "
import json, os

enabled_flag = '${ENABLED_FLAG}'
state_dir = '${STATE_DIR}'

# Only check if agent just disabled itself
try:
    with open(enabled_flag) as f:
        if f.read().strip() == 'enabled':
            raise SystemExit(0)
except FileNotFoundError:
    raise SystemExit(0)

# Check for pending objectives
has_work = False
try:
    with open(os.path.join(state_dir, 'dev-objectives.json')) as f:
        objectives = json.load(f)
    for item in objectives.get('items', []):
        if item.get('status') in ('pending', 'active'):
            has_work = True
            break
except:
    pass

# Check for pending directives
if not has_work:
    try:
        with open(os.path.join(state_dir, 'directives.json')) as f:
            directives = json.load(f)
        for d in directives:
            if d.get('status') in ('pending', 'acknowledged'):
                has_work = True
                break
    except:
        pass

if has_work:
    with open(enabled_flag, 'w') as f:
        f.write('enabled')
    print('IDLE SAFETY NET: Agent self-disabled with pending work. Re-enabled.')
" 2>>"${LOG_DIR}/daemon.log" || true

# Rotate logs (keep last 100)
find "${LOG_DIR}" -name "invocation_*.log" -type f | sort | head -n -100 | xargs rm -f 2>/dev/null || true

# Extract readable transcript and rotate (keep latest 5)
"${AGENT_DIR}/rotate-transcripts.sh" "${INVOCATION_LOG}" 2>>"${LOG_DIR}/daemon.log" || true

exit ${EXIT_CODE}
