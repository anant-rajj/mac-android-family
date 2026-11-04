#!/usr/bin/env bash
# ==============================================================================
# mac-and uninstaller: Stop services and remove CLI links
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Halt running services first if active
if [ -x "${SCRIPT_DIR}/mac-and" ]; then
  "${SCRIPT_DIR}/mac-and" stop 2>/dev/null || true
fi

# Remove global CLI link
rm -f "${HOME}/.local/bin/mac-and"
rm -f "${SCRIPT_DIR}/.family_runtime.pid"
rm -rf "${SCRIPT_DIR}/macos_daemon/.build"

echo "[✓] mac-and has been cleanly uninstalled."
