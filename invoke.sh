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

MAX_TURNS="${AGENT_MAX_TURNS:-25}"
MODEL="${AGENT_MODEL:-claude-opus-4-6}"

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

# Rotate logs (keep last 100)
find "${LOG_DIR}" -name "invocation_*.log" -type f | sort | head -n -100 | xargs rm -f 2>/dev/null || true

exit ${EXIT_CODE}
