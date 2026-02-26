#!/usr/bin/env bash
# ============================================================================
# nudge.sh — Ensure the agent supervisor is running
# ============================================================================
# Enables the agent if disabled and starts the supervisor if not running.
# Safe to run at any time — does nothing if everything is already active.
# ============================================================================

set -euo pipefail

STATE_DIR="/state"
RUN_DIR="/agent/.run"
LOG_DIR="/var/log/agent"
ENABLED_FLAG="${STATE_DIR}/agent_enabled"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── Ensure agent is enabled ──────────────────────────────────────────────

ENABLED=$(cat "${ENABLED_FLAG}" 2>/dev/null | tr -d '[:space:]')
if [[ "${ENABLED}" != "enabled" ]]; then
    echo "enabled" > "${ENABLED_FLAG}"
    echo "[${TIMESTAMP}] Agent was disabled — re-enabled." | tee -a "${LOG_DIR}/daemon.log"
fi

# ── Ensure supervisor is running ─────────────────────────────────────────

if sudo systemctl is-active agent-supervisor --quiet 2>/dev/null; then
    echo "[${TIMESTAMP}] Supervisor is already running (systemd) — nothing to do."
    exit 0
fi

if [[ -f "${RUN_DIR}/supervisor.pid" ]] && kill -0 "$(cat "${RUN_DIR}/supervisor.pid")" 2>/dev/null; then
    echo "[${TIMESTAMP}] Supervisor is already running (PID: $(cat "${RUN_DIR}/supervisor.pid")) — nothing to do."
    exit 0
fi

# Supervisor not running — start it
echo "[${TIMESTAMP}] Supervisor not running. Starting..." | tee -a "${LOG_DIR}/daemon.log"

if sudo systemctl start agent-supervisor 2>/dev/null; then
    echo "[${TIMESTAMP}] Supervisor started via systemd." | tee -a "${LOG_DIR}/daemon.log"
else
    nohup /agent/supervisor.sh >> "${LOG_DIR}/daemon.log" 2>&1 &
    echo "[${TIMESTAMP}] Supervisor started as background process (PID: $!)." | tee -a "${LOG_DIR}/daemon.log"
fi
