#!/usr/bin/env bash
set -euo pipefail
echo "enabled" > /state/agent_enabled
echo "Agent ENABLED. Starting supervisor..."

# Try systemd first, fall back to direct background process
if sudo systemctl start agent-supervisor 2>/dev/null; then
    echo "Supervisor started via systemd."
elif [[ -f /agent/.run/supervisor.pid ]] && kill -0 "$(cat /agent/.run/supervisor.pid)" 2>/dev/null; then
    echo "Supervisor already running (PID: $(cat /agent/.run/supervisor.pid))"
else
    nohup /agent/supervisor.sh >> /var/log/agent/daemon.log 2>&1 &
    echo "Supervisor started as background process (PID: $!)"
fi
echo "Monitor: tail -f /var/log/agent/daemon.log"
