import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { type Qwen2vlConfig, serverBaseUrl } from "./config.js";

export type ServerStatus = {
  running: boolean;
  managed: boolean;
  pid: number | null;
  baseUrl: string;
  healthy: boolean;
  modelLoaded: boolean;
  details: string;
};

let managedProcess: ChildProcess | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 5000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

export async function probeServer(config: Qwen2vlConfig): Promise<ServerStatus> {
  const baseUrl = serverBaseUrl(config);
  try {
    const health = (await fetchJson(`${baseUrl}/health`, undefined, 3000)) as {
      status?: string;
    };
    let modelLoaded = false;
    try {
      const models = (await fetchJson(`${baseUrl}/v1/models`, undefined, 3000)) as {
        data?: Array<{ id?: string }>;
      };
      modelLoaded = Array.isArray(models.data) && models.data.length > 0;
    } catch {
      modelLoaded = health.status === "ok";
    }
    return {
      running: true,
      managed: managedProcess !== null && !managedProcess.killed,
      pid: managedProcess?.pid ?? null,
      baseUrl,
      healthy: health.status === "ok" || modelLoaded,
      modelLoaded,
      details: modelLoaded ? "Server is healthy and model is loaded." : "Server responded but model may still be loading.",
    };
  } catch (error) {
    return {
      running: false,
      managed: managedProcess !== null && !managedProcess.killed,
      pid: managedProcess?.pid ?? null,
      baseUrl,
      healthy: false,
      modelLoaded: false,
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildServerArgs(config: Qwen2vlConfig): string[] {
  const args = [
    "-hf",
    config.hfRepo,
    "--host",
    config.host,
    "--port",
    String(config.port),
    "-c",
    String(config.ctxSize),
    "--parallel",
    "1",
    "--no-ui",
    "--no-webui",
    "--no-ui-mcp-proxy",
  ];
  if (config.gpuLayers && config.gpuLayers !== "auto") {
    args.push("-ngl", config.gpuLayers);
  }
  return args;
}

export async function ensureServer(config: Qwen2vlConfig): Promise<ServerStatus> {
  const current = await probeServer(config);
  if (current.healthy && current.modelLoaded) return current;

  if (!config.autoStartServer) {
    if (current.running) return current;
    throw new Error(
      `llama-server is not reachable at ${current.baseUrl}. Set autoStartServer=true or start llama-server manually.`,
    );
  }

  if (!config.llamaServerBin) {
    throw new Error(
      "llama-server binary not found. Set llamaServerBin in ~/.config/opencode/qwen2vl-mcp.json or LLAMA_SERVER_BIN.",
    );
  }
  if (!fs.existsSync(config.llamaServerBin)) {
    throw new Error(`llama-server binary does not exist: ${config.llamaServerBin}`);
  }

  if (!managedProcess || managedProcess.killed) {
    const args = buildServerArgs(config);
    managedProcess = spawn(config.llamaServerBin, args, {
      cwd: path.dirname(config.llamaServerBin),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        LLAMA_ARG_UI: "0",
        LLAMA_ARG_WEBUI: "0",
      },
    });
    managedProcess.stdout?.on("data", () => {});
    managedProcess.stderr?.on("data", () => {});
    managedProcess.on("exit", () => {
      managedProcess = null;
    });
  }

  const deadline = Date.now() + config.serverStartupTimeoutMs;
  let last: ServerStatus | null = null;
  while (Date.now() < deadline) {
    last = await probeServer(config);
    if (last.healthy && last.modelLoaded) return last;
    await sleep(2000);
  }

  throw new Error(
    `Timed out waiting for llama-server at ${serverBaseUrl(config)}. Last status: ${last?.details ?? "unknown"}`,
  );
}

export async function stopManagedServer(): Promise<string> {
  if (!managedProcess || managedProcess.killed) {
    managedProcess = null;
    return "No managed llama-server process is running.";
  }
  const pid = managedProcess.pid;
  managedProcess.kill();
  managedProcess = null;
  return `Stopped managed llama-server (pid ${pid ?? "unknown"}).`;
}