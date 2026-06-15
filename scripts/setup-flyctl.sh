#!/usr/bin/env bash
# Cursor Cloud setup for Warcrest Fly.io deploys.
set -euo pipefail

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required to install flyctl." >&2
  exit 1
fi

export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"

echo "Installing latest flyctl into $FLYCTL_INSTALL"
if ! curl -fsSL https://fly.io/install.sh | sh; then
  if [[ -x "$FLYCTL_INSTALL/bin/flyctl" ]]; then
    echo "WARN: flyctl installer failed; using existing $FLYCTL_INSTALL/bin/flyctl" >&2
  else
    echo "ERROR: flyctl installer failed and no existing flyctl was found." >&2
    exit 1
  fi
fi

mkdir -p "$HOME/.local/bin"
ln -sf "$FLYCTL_INSTALL/bin/flyctl" "$HOME/.local/bin/flyctl"
ln -sf "$FLYCTL_INSTALL/bin/flyctl" "$HOME/.local/bin/fly"

read -r -d '' PROFILE_BLOCK <<'EOF' || true
# >>> warcrest flyctl setup >>>
export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
case ":$PATH:" in
  *":$FLYCTL_INSTALL/bin:"*) ;;
  *) export PATH="$FLYCTL_INSTALL/bin:$PATH" ;;
esac
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) export PATH="$HOME/.local/bin:$PATH" ;;
esac
if [ -n "${FLY_ACCESS_TOKEN:-}" ] && [ -z "${FLY_API_TOKEN:-}" ]; then
  export FLY_API_TOKEN="$FLY_ACCESS_TOKEN"
fi
# <<< warcrest flyctl setup <<<
EOF

for profile in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
  touch "$profile"
  if ! grep -Fq "# >>> warcrest flyctl setup >>>" "$profile"; then
    {
      printf '\n'
      printf '%s\n' "$PROFILE_BLOCK"
    } >> "$profile"
  fi
done

export PATH="$FLYCTL_INSTALL/bin:$HOME/.local/bin:$PATH"
if [[ -n "${FLY_ACCESS_TOKEN:-}" && -z "${FLY_API_TOKEN:-}" ]]; then
  export FLY_API_TOKEN="$FLY_ACCESS_TOKEN"
fi

flyctl version

if [[ -z "${FLY_ACCESS_TOKEN:-}" && -z "${FLY_API_TOKEN:-}" ]]; then
  echo "NOTE: Configure FLY_ACCESS_TOKEN as a Cursor Cloud secret before deploying."
fi
