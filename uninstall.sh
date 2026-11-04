#!/usr/bin/env bash
# ==============================================================================
# mac-and uninstaller: Complete self-erasure of all components and repository
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Halt running services first if active
if [ -x "${SCRIPT_DIR}/mac-and" ]; then
  "${SCRIPT_DIR}/mac-and" stop 2>/dev/null || true
fi

# Remove global CLI links and caches
rm -f "${HOME}/.local/bin/mac-and" 2>/dev/null || true
rm -f "/usr/local/bin/mac-and" 2>/dev/null || true
rm -rf "${HOME}/.cache/mac-and" 2>/dev/null || true

# Erase the repository directory itself
REPO_DIR="${SCRIPT_DIR}"
echo "[✓] Removing all footprints, binaries, and repository directory..."
(sleep 0.5 && rm -rf "${REPO_DIR}") >/dev/null 2>&1 &

echo "[✓] Complete self-erasure finished. mac-and has been removed."
