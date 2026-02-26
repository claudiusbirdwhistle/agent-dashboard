#!/usr/bin/env bash
# ============================================================================
# rotate-transcripts.sh — Extract readable transcript and keep only 5 latest
# ============================================================================
# Called by invoke.sh after each invocation completes.
# Converts the stream-json log into a readable markdown transcript,
# stores it in /var/log/agent/transcripts/, and removes older ones.
# ============================================================================

set -euo pipefail

LOG_DIR="/var/log/agent"
TRANSCRIPT_DIR="${LOG_DIR}/transcripts"
AGENT_DIR="/agent"
KEEP=5

mkdir -p "${TRANSCRIPT_DIR}"

# Accept log path as argument, or find the most recent invocation log
if [[ -n "${1:-}" ]]; then
    INVOCATION_LOG="$1"
else
    INVOCATION_LOG=$(ls -t "${LOG_DIR}"/invocation_*.log 2>/dev/null | head -1)
fi

if [[ -z "${INVOCATION_LOG}" ]] || [[ ! -f "${INVOCATION_LOG}" ]]; then
    echo "[rotate-transcripts] No invocation log found. Skipping." >&2
    exit 0
fi

# Derive transcript filename from log filename
BASENAME=$(basename "${INVOCATION_LOG}" .log)
TRANSCRIPT_FILE="${TRANSCRIPT_DIR}/${BASENAME}.md"

# Extract readable transcript
python3 "${AGENT_DIR}/extract-transcript.py" "${INVOCATION_LOG}" "${TRANSCRIPT_FILE}" 2>/dev/null || {
    echo "[rotate-transcripts] Failed to extract transcript from ${INVOCATION_LOG}" >&2
    exit 0
}

# Rotate: keep only the N most recent transcripts
TRANSCRIPT_COUNT=$(ls -1 "${TRANSCRIPT_DIR}"/invocation_*.md 2>/dev/null | wc -l)
if [[ "${TRANSCRIPT_COUNT}" -gt "${KEEP}" ]]; then
    ls -t "${TRANSCRIPT_DIR}"/invocation_*.md | tail -n +"$((KEEP + 1))" | xargs rm -f 2>/dev/null || true
fi

echo "[rotate-transcripts] Saved: ${TRANSCRIPT_FILE} (keeping ${KEEP} latest)"
