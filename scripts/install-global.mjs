#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildPortableMcpCommand, defaultHomeRelative } from "./mcp-command.mjs";

const MCP_NAME = "opencode-qwen2vl-mcp";
const ROOT = path.resolve(import.meta.dirname, "..");
const HOME = os.homedir();
const GLOBAL_CONFIG = path.join(HOME, ".config");
const OPENCODE_DIR = process.env.OPENCODE_CONFIG_DIR
  ? path.resolve(process.env.OPENCODE_CONFIG_DIR.replace(/^~/, HOME))
  : path.join(GLOBAL_CONFIG, "opencode");
const INSTALL_DIR = process.env.INSTALL_DIR
  ? path.resolve(process.env.INSTALL_DIR.replace(/^~/, HOME))
  : path.join(GLOBAL_CONFIG, MCP_NAME);

const SYNC_ITEMS = [
  "src",
  "scripts",
  "mcps",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "config.example.json",
  "opencode.json.example",
  "install.ps1",
  "install.sh",
  "README.md",
  "LICENSE",
];

const QWEN_CONFIG = path.join(OPENCODE_DIR, "qwen2vl-mcp.json");
const NPM_TIMEOUT_MS = 300_000;

const MCP_REL_PATH = defaultHomeRelative(MCP_NAME, "dist", "index.js");
const skipNpm = process.argv.includes("--skip-npm");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyTree(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

async function syncToGlobalInstallDir() {
  if (path.resolve(ROOT) === path.resolve(INSTALL_DIR)) {
    return INSTALL_DIR;
  }
  await fs.mkdir(INSTALL_DIR, { recursive: true });
  for (const item of SYNC_ITEMS) {
    const src = path.join(ROOT, item);
    if (!(await exists(src))) continue;
    const dest = path.join(INSTALL_DIR, item);
    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      await fs.rm(dest, { recursive: true, force: true }).catch(() => {});
      await copyTree(src, dest);
    } else {
      await fs.copyFile(src, dest);
    }
  }
  console.log(`Global install dir -> ${INSTALL_DIR}`);
  return INSTALL_DIR;
}

function runNpm(args, cwd) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  console.log(`> ${npm} ${args.join(" ")}`);
  const result = spawnSync(npm, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: NPM_TIMEOUT_MS,
    env: { ...process.env, npm_config_progress: "true" },
  });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function needsNpmInstall(installDir) {
  const nodeModules = path.join(installDir, "node_modules", "@modelcontextprotocol", "sdk");
  return !(await exists(nodeModules));
}

async function runBuild(installDir) {
  if (skipNpm) {
    console.log("Skipping npm install (--skip-npm).");
  } else if (await needsNpmInstall(installDir)) {
    runNpm(["install", "--no-fund", "--no-audit"], installDir);
  } else {
    console.log("Dependencies present — skipping npm install.");
  }
  runNpm(["run", "build"], installDir);
}

async function ensureQwenConfig(installDir) {
  const localConfig = path.join(installDir, "config.json");
  if (!(await exists(QWEN_CONFIG))) {
    const example = path.join(installDir, "config.example.json");
    await fs.mkdir(OPENCODE_DIR, { recursive: true });
    await fs.copyFile(example, QWEN_CONFIG);
    console.log(`Created config template -> ${QWEN_CONFIG}`);
    console.log("Edit llamaServerBin to your llama-server.exe path.");
  }
}

async function readJsoncConfig(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped);
}

async function registerMcp() {
  const mcpEntry = {
    type: "local",
    command: buildPortableMcpCommand(MCP_REL_PATH, { node: true }),
    enabled: true,
    timeout: 300000,
  };

  const candidates = ["opencode.jsonc", "opencode.json"];
  let updated = 0;
  for (const name of candidates) {
    const filePath = path.join(OPENCODE_DIR, name);
    if (!(await exists(filePath))) continue;
    const config = await readJsoncConfig(filePath);
    config.mcp = config.mcp ?? {};
    config.mcp[MCP_NAME] = mcpEntry;
    await fs.writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
    console.log(`Registered MCP in ${filePath}`);
    updated++;
  }

  if (updated === 0) {
    const filePath = path.join(OPENCODE_DIR, "opencode.jsonc");
    await fs.writeFile(
      filePath,
      JSON.stringify({ $schema: "https://opencode.ai/config.json", mcp: { [MCP_NAME]: mcpEntry } }, null, 2) + "\n",
      "utf8",
    );
    console.log(`Created ${filePath} with MCP registration`);
  }
}

async function main() {
  console.log(`Installing ${MCP_NAME} globally...`);
  const installDir = await syncToGlobalInstallDir();
  console.log(`OpenCode config: ${OPENCODE_DIR}`);

  await runBuild(installDir);
  const distEntry = path.join(installDir, "dist", "index.js");
  if (!(await exists(distEntry))) {
    throw new Error(`Build output missing: ${distEntry}`);
  }

  await ensureQwenConfig(installDir);
  await registerMcp();

  console.log("\nDone! Restart OpenCode.");
  console.log(`Global project: ${installDir}`);
  console.log(`MCP relative: ${MCP_REL_PATH}`);
  console.log("Tools: qwen_doctor, qwen_server_status, qwen_server_stop, qwen_describe_image, qwen_ask_image, qwen_ocr_image");
  console.log(`Config: ${QWEN_CONFIG}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});