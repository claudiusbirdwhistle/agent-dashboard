#!/usr/bin/env bash
set -euo pipefail
echo "disabled" > /state/agent_enabled
echo "Agent DISABLED. Current invocation will finish, then no successor will start."
