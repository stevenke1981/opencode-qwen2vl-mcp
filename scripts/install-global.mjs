#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const MCP_NAME = "opencode-qwen2vl-mcp";
const ROOT = path.resolve(import.meta.dirname, "..");
const DIST_ENTRY = path.join(ROOT, "dist", "index.js");
const HOME = os.homedir();
const CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR
  ? path.resolve(process.env.OPENCODE_CONFIG_DIR.replace(/^~/, HOME))
  : path.join(HOME, ".config", "opencode");
const QWEN_CONFIG = path.join(CONFIG_DIR, "qwen2vl-mcp.json");

function toConfigPath(absPath) {
  const normalized = absPath.replace(/\\/g, "/");
  if (normalized.startsWith(HOME.replace(/\\/g, "/"))) {
    return `~${normalized.slice(HOME.replace(/\\/g, "/").length)}`;
  }
  if (process.platform === "win32" && /^[A-Za-z]:/.test(normalized)) {
    return `/${normalized[0].toLowerCase()}${normalized.slice(2)}`;
  }
  return normalized;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function runBuild() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const install = spawnSync(npm, ["install"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (install.status !== 0) process.exit(install.status ?? 1);
  const build = spawnSync(npm, ["run", "build"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

async function ensureQwenConfig() {
  if (await exists(QWEN_CONFIG)) return;
  const example = path.join(ROOT, "config.example.json");
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.copyFile(example, QWEN_CONFIG);
  console.log(`Created config template -> ${QWEN_CONFIG}`);
  console.log("Edit llamaServerBin to your compiled llama-server.exe path.");
}

async function registerMcp(entryPath) {
  const candidates = ["opencode.jsonc", "opencode.json"];
  let configFile = null;
  for (const name of candidates) {
    const p = path.join(CONFIG_DIR, name);
    if (await exists(p)) {
      configFile = p;
      break;
    }
  }
  if (!configFile) {
    configFile = path.join(CONFIG_DIR, "opencode.jsonc");
    await fs.writeFile(
      configFile,
      JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          mcp: {
            [MCP_NAME]: {
              type: "local",
              command: ["node", entryPath],
              enabled: true,
              timeout: 300000,
            },
          },
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    return;
  }

  const raw = await fs.readFile(configFile, "utf8");
  if (raw.includes(MCP_NAME)) {
    console.log(`MCP '${MCP_NAME}' already registered in ${configFile}`);
    return;
  }

  const mcpEntry = {
    type: "local",
    command: ["node", entryPath.replace(/\\/g, "/")],
    enabled: true,
    timeout: 300000,
  };

  let config;
  try {
    const stripped = raw.replace(/\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
    config = JSON.parse(stripped);
  } catch {
    throw new Error(`Could not parse ${configFile}. Add the MCP block from opencode.json.example manually.`);
  }

  config.mcp = config.mcp ?? {};
  config.mcp[MCP_NAME] = mcpEntry;
  const updated = JSON.stringify(config, null, 2) + "\n";

  await fs.writeFile(configFile, updated, "utf8");
  console.log(`Registered MCP in ${configFile}`);
}

async function main() {
  console.log(`Installing ${MCP_NAME}...`);
  runBuild();
  if (!(await exists(DIST_ENTRY))) {
    throw new Error(`Build output missing: ${DIST_ENTRY}`);
  }

  await ensureQwenConfig();
  await registerMcp(toConfigPath(DIST_ENTRY));

  console.log("\nDone! Restart OpenCode.");
  console.log("Tools: qwen_doctor, qwen_server_status, qwen_server_stop, qwen_describe_image, qwen_ask_image, qwen_ocr_image");
  console.log(`Config: ${QWEN_CONFIG}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});