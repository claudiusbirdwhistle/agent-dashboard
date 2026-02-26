#!/usr/bin/env bash
# ============================================================================
# install-supervisor.sh — One-time root setup for the agent supervisor service
# ============================================================================
# Run this as root (or with sudo) to install the systemd service and update
# sudoers so the agent user can manage the supervisor service.
#
#   sudo bash /agent/deploy/install-supervisor.sh
# ============================================================================

set -euo pipefail

echo "Installing agent-supervisor systemd service..."

# Copy service file
cp /agent/deploy/agent-supervisor.service /etc/systemd/system/agent-supervisor.service

# Reload systemd
systemctl daemon-reload

# Enable the service (starts on boot)
systemctl enable agent-supervisor

# Add sudoers entry for agent user to manage the supervisor
SUDOERS_FILE="/etc/sudoers.d/agent-supervisor"
cat > "${SUDOERS_FILE}" << 'EOF'
# Allow agent user to manage the agent-supervisor service
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl start agent-supervisor
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop agent-supervisor
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart agent-supervisor
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl status agent-supervisor
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl is-active agent-supervisor
EOF
chmod 0440 "${SUDOERS_FILE}"

echo "Done. You can now start the supervisor with:"
echo "  sudo systemctl start agent-supervisor"
echo ""
echo "Or the agent user can manage it via:"
echo "  sudo systemctl start agent-supervisor"
echo "  sudo systemctl stop agent-supervisor"
echo "  sudo systemctl status agent-supervisor"
