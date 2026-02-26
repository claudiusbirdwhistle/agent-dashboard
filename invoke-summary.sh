#!/usr/bin/env bash
# ============================================================================
# invoke-summary.sh — Lightweight digest agent
# ============================================================================
# Reads recent agent state and produces a lay-audience summary of what the
# research agent is doing, its findings, and what's next.
#
# Called by supervisor.sh after each research invocation.
# Output: /output/summaries/latest.md (+ archived copies)
# ============================================================================

set -euo pipefail

AGENT_DIR="/agent"
STATE_DIR="/state"
OUTPUT_DIR="/output"
LOG_DIR="/var/log/agent"
SUMMARY_DIR="${OUTPUT_DIR}/summaries"
ARCHIVE_DIR="${SUMMARY_DIR}/archive"

# ── Load config ──────────────────────────────────────────────────────────

if [[ -f "${AGENT_DIR}/agent.env" ]]; then
    set -a
    source "${AGENT_DIR}/agent.env"
    set +a
fi

MODEL="${AGENT_SUMMARY_MODEL:-claude-sonnet-4-6}"
MAX_TURNS="${AGENT_SUMMARY_MAX_TURNS:-3}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Resolve Claude binary ────────────────────────────────────────────────

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

# ── Ensure directories exist ─────────────────────────────────────────────

mkdir -p "${SUMMARY_DIR}" "${ARCHIVE_DIR}"

# ── Gather context for the summary agent ─────────────────────────────────

# Last 8KB of journal
JOURNAL_TAIL=""
if [[ -f "${STATE_DIR}/journal.md" ]]; then
    JOURNAL_TAIL=$(tail -c 8192 "${STATE_DIR}/journal.md")
fi

# Phase, objectives, health (full files — they're small)
PHASE_JSON=""
[[ -f "${STATE_DIR}/phase.json" ]] && PHASE_JSON=$(cat "${STATE_DIR}/phase.json")

OBJECTIVES_JSON=""
[[ -f "${STATE_DIR}/dev-objectives.json" ]] && OBJECTIVES_JSON=$(cat "${STATE_DIR}/dev-objectives.json")

HEALTH_JSON=""
[[ -f "${STATE_DIR}/health.json" ]] && HEALTH_JSON=$(cat "${STATE_DIR}/health.json")

# First 4KB of beliefs
BELIEFS_HEAD=""
if [[ -f "${STATE_DIR}/beliefs.md" ]]; then
    BELIEFS_HEAD=$(head -c 4096 "${STATE_DIR}/beliefs.md")
fi

# Previous summary for continuity
PREV_SUMMARY=""
if [[ -f "${SUMMARY_DIR}/latest.md" ]]; then
    PREV_SUMMARY=$(cat "${SUMMARY_DIR}/latest.md")
fi

# ── Build prompt ─────────────────────────────────────────────────────────

PROMPT="Write the summary to /output/summaries/latest.md based on the following context.

--- CONTEXT ---

### phase.json
${PHASE_JSON:-"(not yet created)"}

### health.json
${HEALTH_JSON:-"(not yet created)"}

### dev-objectives.json
${OBJECTIVES_JSON:-"(not yet created)"}

### journal.md (last 8KB)
${JOURNAL_TAIL:-"(no journal entries yet)"}

### beliefs.md (first 4KB)
${BELIEFS_HEAD:-"(no beliefs recorded yet)"}

### Previous summary
${PREV_SUMMARY:-"(no previous summary — this is the first one)"}

---

Now write the updated summary to /output/summaries/latest.md. Output ONLY the
Markdown content for the file — no preamble, no explanation, no code fences."

# ── Execute ──────────────────────────────────────────────────────────────

SUMMARY_LOG="${LOG_DIR}/summary_${TIMESTAMP}.log"

echo "=== Summary invocation: ${TIMESTAMP} ===" >> "${SUMMARY_LOG}"

# Run from the summary agent's own directory with its own CLAUDE.md
cd /agent/summary-agent

# Prevent nested session detection
unset CLAUDECODE 2>/dev/null || true

"${CLAUDE_BIN}" \
    -p "${PROMPT}" \
    --dangerously-skip-permissions \
    --max-turns "${MAX_TURNS}" \
    --model "${MODEL}" \
    --output-format text \
    >> "${SUMMARY_LOG}" 2>&1

EXIT_CODE=$?

echo "" >> "${SUMMARY_LOG}"
echo "=== Exit code: ${EXIT_CODE} ===" >> "${SUMMARY_LOG}"

# ── Archive the summary ──────────────────────────────────────────────────

if [[ -f "${SUMMARY_DIR}/latest.md" ]]; then
    cp "${SUMMARY_DIR}/latest.md" "${ARCHIVE_DIR}/${TIMESTAMP}.md"
fi

# ── Rotate archive (keep last 50) ────────────────────────────────────────

ARCHIVE_COUNT=$(find "${ARCHIVE_DIR}" -name "*.md" -type f | wc -l)
if [[ "${ARCHIVE_COUNT}" -gt 50 ]]; then
    find "${ARCHIVE_DIR}" -name "*.md" -type f | sort | head -n -50 | xargs rm -f 2>/dev/null || true
fi

# ── Rotate summary logs (keep last 20) ──────────────────────────────────

find "${LOG_DIR}" -name "summary_*.log" -type f | sort | head -n -20 | xargs rm -f 2>/dev/null || true

exit ${EXIT_CODE}
