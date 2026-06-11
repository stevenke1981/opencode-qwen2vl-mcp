/**
 * Build OpenCode-local MCP command arrays portable across machines.
 * - Windows: pwsh + $env:USERPROFILE (OpenCode does not expand ~ or %VAR%)
 * - Linux/macOS: sh + $HOME
 */
export function buildPortableMcpCommand(relativeFromHome, { node = false } = {}) {
  const rel = relativeFromHome.replace(/^\/+/, "").replace(/\\/g, "/");

  if (process.platform === "win32") {
    const relWin = rel.replace(/\//g, "\\");
    const ps = node
      ? `node \"$env:USERPROFILE\\${relWin}\"`
      : `& \"$env:USERPROFILE\\${relWin}\"`;
    return ["pwsh", "-NoProfile", "-Command", ps];
  }

  const target = `$HOME/${rel}`;
  const shCmd = node ? `exec node "${target}"` : `exec "${target}"`;
  return ["sh", "-c", shCmd];
}

export function defaultHomeRelative(projectName, ...parts) {
  const file = parts.join("/");
  return `.config/${projectName}/${file}`;
}