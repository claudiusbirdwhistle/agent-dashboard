#!/usr/bin/env bash
set -euo pipefail
echo "disabled" > /state/agent_enabled

# Stop supervisor (systemd or background process)
sudo systemctl stop agent-supervisor 2>/dev/null && echo "Stopped supervisor via systemd" || true
if [[ -f /agent/.run/supervisor.pid ]]; then
    SPID=$(cat /agent/.run/supervisor.pid)
    if kill -0 "${SPID}" 2>/dev/null; then
        kill "${SPID}" 2>/dev/null && echo "Killed supervisor process (PID: ${SPID})" || true
    fi
    rm -f /agent/.run/supervisor.pid
fi

# Kill running Claude process
pkill -u agent -f "claude.*-p" 2>/dev/null && echo "Killed running Claude process" || echo "No running Claude process"

# Clean up PID file and lock
rm -f /agent/.run/invoke.pid
rm -f /agent/.run/invoke.lock

echo "Agent DISABLED and killed."
