#!/usr/bin/env bash
set -euo pipefail
STATE_DIR="/state"
RUN_DIR="/agent/.run"
LOG_DIR="/var/log/agent"

echo "============================================================"
echo "  Autonomous Research Agent — Status"
echo "============================================================"
echo ""
ENABLED=$(cat "${STATE_DIR}/agent_enabled" 2>/dev/null | tr -d '[:space:]')
[[ "${ENABLED}" == "enabled" ]] && echo "  Control:    ENABLED" || echo "  Control:    DISABLED"

# Check supervisor status
SUPERVISOR_STATUS="stopped"
if sudo systemctl is-active agent-supervisor --quiet 2>/dev/null; then
    SUPERVISOR_STATUS="running (systemd)"
elif [[ -f "${RUN_DIR}/supervisor.pid" ]] && kill -0 "$(cat "${RUN_DIR}/supervisor.pid")" 2>/dev/null; then
    SUPERVISOR_STATUS="running (PID: $(cat "${RUN_DIR}/supervisor.pid"))"
fi
echo "  Supervisor: ${SUPERVISOR_STATUS}"

# Check invocation status via PID file
if [[ -f "${RUN_DIR}/invoke.pid" ]] && kill -0 "$(cat "${RUN_DIR}/invoke.pid")" 2>/dev/null; then
    echo "  Process:    RUNNING (PID: $(cat "${RUN_DIR}/invoke.pid"))"
elif [[ "${SUPERVISOR_STATUS}" != "stopped" ]]; then
    echo "  Process:    SLEEPING (between invocations)"
else
    echo "  Process:    IDLE"
fi
echo ""
[[ -f "${STATE_DIR}/phase.json" ]] && echo "  Phase:      $(jq -r '.phase // "unknown"' "${STATE_DIR}/phase.json" 2>/dev/null)"
[[ -f "${STATE_DIR}/health.json" ]] && echo "  Stalls:     $(jq -r '.stall_count // 0' "${STATE_DIR}/health.json" 2>/dev/null)" && echo "  Invocations: $(jq -r '.total_invocations // 0' "${STATE_DIR}/health.json" 2>/dev/null)"
[[ -f "${STATE_DIR}/dev-tasks.json" ]] && echo "  Tasks: $(jq '[.items[] | select(.status == "active" or .status == "pending")] | length' "${STATE_DIR}/dev-tasks.json" 2>/dev/null) active/pending"
echo ""
echo "============================================================"
