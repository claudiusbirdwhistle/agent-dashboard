#!/usr/bin/env bash
# ============================================================================
# install-dashboard-next.sh — One-time root setup for the Next.js dashboard
# ============================================================================
# Run this as root (or with sudo) to install the systemd service.
#
#   sudo bash /agent/deploy/install-dashboard-next.sh
# ============================================================================

set -euo pipefail

echo "Installing agent-dashboard-next systemd service..."

# Copy service file
cp /agent/deploy/agent-dashboard-next.service /etc/systemd/system/agent-dashboard-next.service

# Reload systemd
systemctl daemon-reload

# Enable and start the service
systemctl enable --now agent-dashboard-next

# Add sudoers entry for agent user to manage the service
SUDOERS_FILE="/etc/sudoers.d/agent-dashboard-next"
cat > "${SUDOERS_FILE}" << 'EOF'
# Allow agent user to manage the agent-dashboard-next service
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl start agent-dashboard-next
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop agent-dashboard-next
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart agent-dashboard-next
agent ALL=(ALL) NOPASSWD: /usr/bin/systemctl status agent-dashboard-next
EOF
chmod 0440 "${SUDOERS_FILE}"

echo "Done. Next.js dashboard is running on port 3001."
