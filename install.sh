#!/usr/bin/env bash
# ==============================================================================
# mac-and installer: Install global CLI shortcut
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${HOME}/.local/bin"
mkdir -p "${INSTALL_DIR}"

ln -sf "${SCRIPT_DIR}/mac-and" "${INSTALL_DIR}/mac-and"
chmod +x "${SCRIPT_DIR}/mac-and"

echo "[✓] Successfully linked mac-and to ${INSTALL_DIR}/mac-and"

if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
  echo ""
  echo "[!] Notice: ${INSTALL_DIR} is not currently in your PATH."
  echo "    Add this line to your ~/.zshrc or ~/.bash_profile:"
  echo "    export PATH=\"\${HOME}/.local/bin:\$PATH\""
fi

echo ""
echo "Installation complete. Try: mac-and help"
