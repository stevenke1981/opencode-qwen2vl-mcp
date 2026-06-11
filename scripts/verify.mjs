#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const entry = path.join(ROOT, "dist", "index.js");

const child = spawn("node", [entry], {
  stdio: ["pipe", "pipe", "inherit"],
});

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

child.stdin.write(JSON.stringify(init) + "\n");
child.stdin.end();

let stdout = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});

child.on("close", (code) => {
  if (code !== 0) {
    console.error(`MCP server exited with code ${code}`);
    process.exit(code ?? 1);
  }
  if (!stdout.includes("opencode-qwen2vl-mcp") && !stdout.includes("result")) {
    console.error("Unexpected MCP response:", stdout.slice(0, 500));
    process.exit(1);
  }
  console.log("MCP server starts and responds to initialize.");
});