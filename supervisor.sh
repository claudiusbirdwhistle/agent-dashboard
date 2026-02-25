#!/usr/bin/env bash
# ============================================================================
# supervisor.sh — External supervisor loop for the autonomous agent
# ============================================================================
# Runs as a systemd service (or background process). Loops: check enabled
# flag, acquire flock, run agent, sleep, repeat.
#
# Watchdog: kills hung invocations on two conditions:
#   1. Log inactivity — no output written for AGENT_INACTIVITY_TIMEOUT seconds
#      (default: 600). A healthy invocation writes continuously; silence means
#      the process is stuck.
#   2. Hard timeout — invocation has run longer than AGENT_MAX_DURATION seconds
#      (default: 3600) regardless of activity.
#
# Both thresholds are configurable in agent.env.
# ============================================================================

set -euo pipefail

AGENT_DIR="/agent"
STATE_DIR="/state"
LOG_DIR="/var/log/agent"
RUN_DIR="/agent/.run"
LOCK_FILE="${RUN_DIR}/invoke.lock"
ENABLED_FLAG="${STATE_DIR}/agent_enabled"

mkdir -p "${RUN_DIR}" "${LOG_DIR}"

# ── Load config ──────────────────────────────────────────────────────────

if [[ -f "${AGENT_DIR}/agent.env" ]]; then
    set -a
    source "${AGENT_DIR}/agent.env"
    set +a
fi

DELAY="${AGENT_INVOKE_DELAY:-7}"
INACTIVITY_TIMEOUT="${AGENT_INACTIVITY_TIMEOUT:-600}"   # 10 min default
MAX_DURATION="${AGENT_MAX_DURATION:-3600}"               # 60 min default

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [supervisor] $*" >> "${LOG_DIR}/daemon.log"
}

# Write our PID so status checks can find us
echo $$ > "${RUN_DIR}/supervisor.pid"

cleanup() {
    rm -f "${RUN_DIR}/supervisor.pid"
    log "Supervisor stopped (PID $$)"
}
trap cleanup EXIT

log "Supervisor starting (PID $$, delay=${DELAY}s, inactivity_timeout=${INACTIVITY_TIMEOUT}s, max_duration=${MAX_DURATION}s)"

# ── Kill the running invocation and all its children ─────────────────────
# Sends SIGTERM first, waits 5s, then SIGKILL. Targets:
#   - invoke.sh (PID from PID file)
#   - All direct children of invoke.sh (claude subprocess, stdbuf, tee)
#   - The background flock subshell we launched

kill_invocation() {
    local reason="$1"
    log "WATCHDOG: ${reason}. Terminating invocation."

    local invoke_pid=""
    if [[ -f "${RUN_DIR}/invoke.pid" ]]; then
        invoke_pid=$(cat "${RUN_DIR}/invoke.pid" 2>/dev/null || true)
    fi

    if [[ -n "${invoke_pid}" ]]; then
        # Terminate children first (claude, stdbuf, tee pipeline)
        pkill -TERM -P "${invoke_pid}" 2>/dev/null || true
        kill -TERM "${invoke_pid}" 2>/dev/null || true
    fi

    # Also terminate the background flock subshell
    if [[ -n "${SUBSHELL_PID:-}" ]]; then
        kill -TERM "${SUBSHELL_PID}" 2>/dev/null || true
    fi

    sleep 5

    # Force-kill anything still alive
    if [[ -n "${invoke_pid}" ]]; then
        pkill -KILL -P "${invoke_pid}" 2>/dev/null || true
        kill -KILL "${invoke_pid}" 2>/dev/null || true
    fi
    if [[ -n "${SUBSHELL_PID:-}" ]]; then
        kill -KILL "${SUBSHELL_PID}" 2>/dev/null || true
    fi

    log "WATCHDOG: Kill complete."
}

# ── Watchdog loop — runs while an invocation is in progress ──────────────
# Polls every 15 seconds. Returns 0 if invocation finished cleanly,
# 1 if it was killed by the watchdog.

watchdog_wait() {
    local start_time="$1"
    SUBSHELL_PID="${2}"

    while kill -0 "${SUBSHELL_PID}" 2>/dev/null; do
        sleep 15

        local now elapsed
        now=$(date +%s)
        elapsed=$((now - start_time))

        # Hard wall-clock timeout
        if [[ ${elapsed} -gt ${MAX_DURATION} ]]; then
            kill_invocation "Hard timeout: ${elapsed}s elapsed (max ${MAX_DURATION}s)"
            return 1
        fi

        # Log inactivity timeout — only applies once current.log symlink exists
        if [[ -L "${LOG_DIR}/current.log" ]] && [[ -e "${LOG_DIR}/current.log" ]]; then
            local log_mtime log_age
            log_mtime=$(stat -c %Y "${LOG_DIR}/current.log" 2>/dev/null || echo "${start_time}")
            log_age=$((now - log_mtime))
            if [[ ${log_age} -gt ${INACTIVITY_TIMEOUT} ]]; then
                kill_invocation "Log inactivity: no output for ${log_age}s (threshold ${INACTIVITY_TIMEOUT}s)"
                return 1
            fi
        fi
    done

    return 0
}

# ── Main loop ────────────────────────────────────────────────────────────

while true; do

    # ── Check enable/disable flag ─────────────────────────────────────────
    if [[ -f "${ENABLED_FLAG}" ]]; then
        STATUS=$(cat "${ENABLED_FLAG}" | tr -d '[:space:]')
        if [[ "${STATUS}" != "enabled" ]]; then
            sleep 5
            continue
        fi
    else
        # No flag file — treat as disabled
        sleep 5
        continue
    fi

    # ── Acquire flock and launch invocation in background ─────────────────
    # Running in background lets the watchdog monitor it from the foreground.
    # AGENT_SUPERVISED tells invoke.sh to skip its own flock (we hold it).
    SUBSHELL_PID=""

    (
        if ! flock --nonblock 9; then
            log "Lock already held — another invocation is running. Retrying in 2s."
            exit 1
        fi

        log "Starting agent invocation"
        AGENT_SUPERVISED=1 "${AGENT_DIR}/invoke.sh" || {
            EXIT_CODE=$?
            log "Agent exited with code ${EXIT_CODE}"
        }

    ) 9>"${LOCK_FILE}" &

    SUBSHELL_PID=$!
    START_TIME=$(date +%s)

    # Give invoke.sh a moment to acquire the lock; if it failed (another
    # instance already running), the subshell exits almost immediately.
    sleep 2
    if ! kill -0 "${SUBSHELL_PID}" 2>/dev/null; then
        log "Invocation subshell exited immediately (lock contention). Retrying in 2s."
        sleep 2
        continue
    fi

    # ── Run watchdog until invocation completes or is killed ──────────────
    watchdog_wait "${START_TIME}" "${SUBSHELL_PID}" || true

    # Reap the background job (suppress error if already gone)
    wait "${SUBSHELL_PID}" 2>/dev/null || true

    # ── Delay before next cycle ───────────────────────────────────────────
    log "Cycle complete. Sleeping ${DELAY}s before next invocation."
    sleep "${DELAY}"

done
