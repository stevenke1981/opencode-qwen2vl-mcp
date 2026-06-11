#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const globalEntry = path.join(os.homedir(), ".config", "opencode-qwen2vl-mcp", "dist", "index.js");
const localEntry = path.join(ROOT, "dist", "index.js");
const entry = process.env.QWEN2VL_MCP_ENTRY ?? (await import("node:fs/promises").then((fs) =>
  fs.access(globalEntry).then(() => globalEntry).catch(() => localEntry),
));

function mcpRoundtrip(entryPath, messages) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [entryPath], { stdio: ["pipe", "pipe", "inherit"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`MCP server exited with code ${code}`));
      else resolve(stdout);
    });
    for (const msg of messages) {
      child.stdin.write(JSON.stringify(msg) + "\n");
    }
    child.stdin.end();
  });
}

const init = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify", version: "1.0.0" },
  },
};
const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };
const doctor = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: { name: "qwen_doctor", arguments: {} },
};

const stdout = await mcpRoundtrip(entry, [init, initialized, doctor]);

if (!stdout.includes("opencode-qwen2vl-mcp")) {
  console.error("Unexpected MCP initialize response:", stdout.slice(0, 500));
  process.exit(1);
}
if (!stdout.includes("Qwen2-VL MCP Doctor")) {
  console.error("qwen_doctor did not respond:", stdout.slice(0, 500));
  process.exit(1);
}

console.log("MCP server starts, responds to initialize, and qwen_doctor works.");
if (stdout.includes("Server healthy: true") && stdout.includes("Model loaded: true")) {
  console.log("llama-server is healthy with model loaded.");
} else if (stdout.includes("llama-server binary not found") || stdout.includes("NOT FOUND")) {
  console.log("Note: llama-server not configured — set llamaServerBin in qwen2vl-mcp.json");
} else {
  console.log("Note: llama-server not running yet — will auto-start on first vision call.");
}