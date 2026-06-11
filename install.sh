#!/usr/bin/env bash
set -euo pipefail

GLOBAL_CONFIG="${HOME}/.config"
INSTALL_DIR="${GLOBAL_CONFIG}/opencode-qwen2vl-mcp"
REPO="https://github.com/stevenke1981/opencode-qwen2vl-mcp.git"

echo "opencode-qwen2vl-mcp global installer"
echo "Install dir: ${INSTALL_DIR}"

if [[ ! -d "${INSTALL_DIR}/.git" ]]; then
  echo "Cloning to ${INSTALL_DIR} ..."
  mkdir -p "${GLOBAL_CONFIG}"
  git clone "${REPO}" "${INSTALL_DIR}"
elif [[ "$(cd "$(dirname "$0")" && pwd)" != "${INSTALL_DIR}" ]]; then
  echo "Updating ${INSTALL_DIR} ..."
  git -C "${INSTALL_DIR}" pull --ff-only
fi

cd "${INSTALL_DIR}"
node scripts/install-global.mjs