import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type Qwen2vlConfig = {
  llamaServerBin: string | null;
  llamaMtmdCliBin: string | null;
  hfRepo: string;
  host: string;
  port: number;
  ctxSize: number;
  gpuLayers: string;
  autoStartServer: boolean;
  serverStartupTimeoutMs: number;
  requestTimeoutMs: number;
  maxTokens: number;
  configPath: string | null;
};

const DEFAULTS: Omit<Qwen2vlConfig, "configPath"> = {
  llamaServerBin: null,
  llamaMtmdCliBin: null,
  hfRepo: "ggml-org/Qwen2-VL-2B-Instruct-GGUF",
  host: "127.0.0.1",
  port: 8188,
  ctxSize: 8192,
  gpuLayers: "auto",
  autoStartServer: true,
  serverStartupTimeoutMs: 300_000,
  requestTimeoutMs: 120_000,
  maxTokens: 1024,
};

const BINARY_CANDIDATES = {
  server: ["llama-server.exe", "llama-server"],
  mtmd: ["llama-mtmd-cli.exe", "llama-mtmd-cli"],
};

const SEARCH_DIRS = [
  process.env.LLAMA_CPP_BIN,
  process.env.LLAMA_CPP_HOME,
  path.join(os.homedir(), ".config", "llama-cpp"),
  "C:/llama.cpp/build/bin/Release",
  "C:/llama.cpp/build/bin",
  "D:/llama.cpp/build/bin/Release",
  "D:/llama.cpp/build/bin",
  "C:/llama.cpp",
  "D:/llama.cpp",
].filter(Boolean) as string[];

function configCandidates(): string[] {
  const home = os.homedir();
  return [
    process.env.QWEN2VL_MCP_CONFIG,
    path.join(home, ".config", "opencode", "qwen2vl-mcp.json"),
    path.join(home, ".config", "opencode-qwen2vl-mcp", "config.json"),
    path.join(home, ".config", "qwen2vl-mcp", "config.json"),
  ].filter(Boolean) as string[];
}

function readJsonFile(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function exists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

function findBinary(names: string[]): string | null {
  for (const dir of SEARCH_DIRS) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

function pickString(
  fileValue: unknown,
  envValue: string | undefined,
  fallback: string | null,
): string | null {
  if (typeof fileValue === "string" && fileValue.trim()) return fileValue.trim();
  if (envValue?.trim()) return envValue.trim();
  return fallback;
}

function pickNumber(fileValue: unknown, envValue: string | undefined, fallback: number): number {
  if (typeof fileValue === "number" && Number.isFinite(fileValue)) return fileValue;
  if (envValue) {
    const parsed = Number(envValue);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function pickBoolean(fileValue: unknown, envValue: string | undefined, fallback: boolean): boolean {
  if (typeof fileValue === "boolean") return fileValue;
  if (envValue !== undefined) return envValue !== "0" && envValue.toLowerCase() !== "false";
  return fallback;
}

export function loadConfig(): Qwen2vlConfig {
  let fileConfig: Record<string, unknown> = {};
  let configPath: string | null = null;
  for (const candidate of configCandidates()) {
    const parsed = readJsonFile(candidate);
    if (parsed) {
      fileConfig = parsed;
      configPath = candidate;
      break;
    }
  }

  const llamaServerBin = pickString(
    fileConfig.llamaServerBin,
    process.env.LLAMA_SERVER_BIN,
    findBinary(BINARY_CANDIDATES.server),
  );
  const llamaMtmdCliBin = pickString(
    fileConfig.llamaMtmdCliBin,
    process.env.LLAMA_MTMD_CLI_BIN,
    findBinary(BINARY_CANDIDATES.mtmd),
  );

  return {
    configPath,
    llamaServerBin,
    llamaMtmdCliBin,
    hfRepo: pickString(fileConfig.hfRepo, process.env.QWEN2VL_HF_REPO, DEFAULTS.hfRepo)!,
    host: pickString(fileConfig.host, process.env.QWEN2VL_HOST, DEFAULTS.host)!,
    port: pickNumber(fileConfig.port, process.env.QWEN2VL_PORT, DEFAULTS.port),
    ctxSize: pickNumber(fileConfig.ctxSize, process.env.QWEN2VL_CTX_SIZE, DEFAULTS.ctxSize),
    gpuLayers: pickString(fileConfig.gpuLayers, process.env.QWEN2VL_GPU_LAYERS, DEFAULTS.gpuLayers)!,
    autoStartServer: pickBoolean(
      fileConfig.autoStartServer,
      process.env.QWEN2VL_AUTO_START,
      DEFAULTS.autoStartServer,
    ),
    serverStartupTimeoutMs: pickNumber(
      fileConfig.serverStartupTimeoutMs,
      process.env.QWEN2VL_STARTUP_TIMEOUT_MS,
      DEFAULTS.serverStartupTimeoutMs,
    ),
    requestTimeoutMs: pickNumber(
      fileConfig.requestTimeoutMs,
      process.env.QWEN2VL_REQUEST_TIMEOUT_MS,
      DEFAULTS.requestTimeoutMs,
    ),
    maxTokens: pickNumber(fileConfig.maxTokens, process.env.QWEN2VL_MAX_TOKENS, DEFAULTS.maxTokens),
  };
}

export function serverBaseUrl(config: Qwen2vlConfig): string {
  return `http://${config.host}:${config.port}`;
}