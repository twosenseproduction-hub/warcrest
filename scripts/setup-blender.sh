#!/usr/bin/env bash
# Install Blender for the Warcrest headless rigging pipeline (tools/rig/).
set -euo pipefail

if command -v blender >/dev/null 2>&1; then
  echo "Blender already installed: $(blender --version 2>/dev/null | head -1)"
  exit 0
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "ERROR: this helper targets Linux (apt). Install Blender manually on other OSes." >&2
  exit 1
fi

echo "Installing Blender via apt…"
sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq blender

blender --version | head -1
blender -b -noaudio --python-expr "import bpy; print('OK', bpy.app.version_string)"
