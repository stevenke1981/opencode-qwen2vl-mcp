#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const MCP_NAME = "opencode-qwen2vl-mcp";
const HOME = os.homedir();
const GLOBAL_CONFIG = path.join(HOME, ".config");
const INSTALL_DIR = path.join(GLOBAL_CONFIG, MCP_NAME);
const OPENCODE_DIR = path.join(GLOBAL_CONFIG, "opencode");
const QWEN_CONFIG = path.join(OPENCODE_DIR, "qwen2vl-mcp.json");
const ENTRY = path.join(INSTALL_DIR, "dist", "index.js");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonc(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped);
}

function checkMcpInit(entry) {
  return new Promise((resolve) => {
    const child = spawn("node", [entry], { stdio: ["pipe", "pipe", "inherit"] });
    const init = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "doctor", version: "1.0.0" },
      },
    };
    child.stdin.write(JSON.stringify(init) + "\n");
    child.stdin.end();
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.on("close", () => resolve(out));
    setTimeout(() => {
      child.kill();
      resolve(out);
    }, 8000);
  });
}

async function probeLlamaServer(host, port) {
  try {
    const base = `http://${host}:${port}`;
    const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    if (!health.ok) return { running: false, healthy: false, details: `HTTP ${health.status}` };
    const models = await fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(3000) });
    const payload = models.ok ? await models.json() : {};
    const modelLoaded = Array.isArray(payload.data) && payload.data.length > 0;
    return {
      running: true,
      healthy: true,
      modelLoaded,
      details: modelLoaded ? "Model loaded." : "Server up; model may still be loading.",
    };
  } catch (error) {
    return {
      running: false,
      healthy: false,
      modelLoaded: false,
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

const lines = [`# ${MCP_NAME} Doctor`, ""];
let failed = false;

lines.push(`Install dir: ${INSTALL_DIR}`);
if (await exists(ENTRY)) {
  lines.push(`MCP entry: ${ENTRY} (OK)`);
} else {
  lines.push(`MCP entry: MISSING ${ENTRY}`);
  lines.push("Fix: node scripts/install-global.mjs");
  failed = true;
}

let cfg = {};
if (await exists(QWEN_CONFIG)) {
  cfg = JSON.parse(await fs.readFile(QWEN_CONFIG, "utf8"));
  lines.push(`User config: ${QWEN_CONFIG}`);
} else {
  lines.push(`User config: (missing) ${QWEN_CONFIG}`);
  lines.push("Fix: node scripts/install-global.mjs (creates template)");
}

const llamaBin = cfg.llamaServerBin;
if (llamaBin && (await exists(llamaBin))) {
  lines.push(`llama-server: ${llamaBin} (OK)`);
} else if (llamaBin) {
  lines.push(`llama-server: NOT FOUND at ${llamaBin}`);
  failed = true;
} else {
  const fallback = path.join(GLOBAL_CONFIG, "llama-cpp", process.platform === "win32" ? "llama-server.exe" : "llama-server");
  if (await exists(fallback)) {
    lines.push(`llama-server: ${fallback} (auto-discovered)`);
  } else {
    lines.push("llama-server: NOT CONFIGURED");
    lines.push('Fix: set llamaServerBin in qwen2vl-mcp.json');
    failed = true;
  }
}

for (const name of ["opencode.jsonc", "opencode.json"]) {
  const filePath = path.join(OPENCODE_DIR, name);
  if (!(await exists(filePath))) continue;
  const config = await readJsonc(filePath);
  const mcp = config.mcp?.[MCP_NAME];
  if (!mcp) {
    lines.push(`WARN: ${name} has no ${MCP_NAME} entry`);
    failed = true;
    continue;
  }
  const cmd = Array.isArray(mcp.command) ? mcp.command.join(" ") : `${mcp.command ?? ""} ${(mcp.args ?? []).join(" ")}`.trim();
  lines.push(`${name}: type=${mcp.type ?? "(legacy)"} enabled=${mcp.enabled ?? true}`);
  if (!mcp.type || mcp.type !== "local") {
    lines.push(`  FIX NEEDED: missing type:"local" — rerun installer`);
    failed = true;
  }
  if (!Array.isArray(mcp.command)) {
    lines.push(`  FIX NEEDED: command must be an array for OpenCode`);
    failed = true;
  }
  if (cmd.includes("Users\\eda\\") || cmd.includes("/eda/")) {
    lines.push(`  FIX NEEDED: stale path from another user`);
    failed = true;
  }
  if (process.platform === "win32" && (cmd.includes("~/.config/") || /^[A-Za-z]:\/Users\//.test(cmd))) {
    lines.push(`  FIX NEEDED: use portable pwsh + $env:USERPROFILE — rerun installer`);
    failed = true;
  }
  if (process.platform === "win32" && cmd.includes("$env:USERPROFILE")) {
    lines.push(`  Portable Windows command: OK`);
  }
  if (process.platform !== "win32" && cmd.includes("$HOME")) {
    lines.push(`  Portable Unix command: OK`);
  }
  if (process.platform !== "win32" && cmd.includes("pwsh")) {
    lines.push(`  FIX NEEDED: use sh + $HOME on Linux/macOS — rerun installer`);
    failed = true;
  }
}

if (await exists(ENTRY)) {
  const initOut = await checkMcpInit(ENTRY);
  if (initOut.includes(MCP_NAME)) {
    lines.push("MCP initialize: OK");
  } else {
    lines.push("MCP initialize: FAILED");
    lines.push(initOut.slice(0, 300));
    failed = true;
  }
}

const host = cfg.host ?? "127.0.0.1";
const port = cfg.port ?? 8188;
const server = await probeLlamaServer(host, port);
lines.push(
  "",
  `llama-server probe (${host}:${port}):`,
  `  running: ${server.running}`,
  `  healthy: ${server.healthy}`,
  `  modelLoaded: ${server.modelLoaded ?? false}`,
  `  details: ${server.details}`,
);
if (!server.running && cfg.autoStartServer !== false) {
  lines.push("  Note: server will auto-start on first qwen_* tool call.");
}

const pkg = path.join(INSTALL_DIR, "package.json");
if (await exists(pkg)) {
  const { version } = JSON.parse(await fs.readFile(pkg, "utf8"));
  lines.push("", `Package version: ${version}`);
}

lines.push("", "If OpenCode still cannot see tools: restart OpenCode, then run `opencode mcp list`.");
console.log(lines.join("\n"));
process.exit(failed ? 1 : 0);