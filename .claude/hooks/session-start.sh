#!/bin/bash
# SessionStart hook: install flyctl so Claude Code remote sessions can deploy to Fly.io.
set -euo pipefail

# Only run in Claude Code remote environments.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Skip if flyctl is already on PATH (container cache hit).
if command -v flyctl >/dev/null 2>&1 || command -v fly >/dev/null 2>&1; then
  echo "flyctl already installed, skipping setup."
  exit 0
fi

echo "Installing flyctl for Fly.io deploys..."
bash "$CLAUDE_PROJECT_DIR/scripts/setup-flyctl.sh"

# Persist PATH and token remapping for the session.
{
  echo "export FLYCTL_INSTALL=\"\${FLYCTL_INSTALL:-\$HOME/.fly}\""
  echo "export PATH=\"\$FLYCTL_INSTALL/bin:\$HOME/.local/bin:\$PATH\""
  echo 'if [ -n "${FLY_ACCESS_TOKEN:-}" ] && [ -z "${FLY_API_TOKEN:-}" ]; then'
  echo '  export FLY_API_TOKEN="$FLY_ACCESS_TOKEN"'
  echo 'fi'
} >> "${CLAUDE_ENV_FILE:-/dev/null}"
