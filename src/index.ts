#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { loadImage } from "./image.js";
import { ensureServer, probeServer, stopManagedServer } from "./llama-server.js";
import { PROMPTS, askAboutImage } from "./vision.js";

const config = loadConfig();

const server = new McpServer({
  name: "opencode-qwen2vl-mcp",
  version: "1.0.0",
});

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

server.tool(
  "qwen_doctor",
  "Diagnose Qwen2-VL + llama.cpp setup. Run this first when vision tools fail.",
  {},
  async () => {
    const lines: string[] = [
      "# Qwen2-VL MCP Doctor",
      "",
      `Config file: ${config.configPath ?? "(none, using env/defaults)"}`,
      `HF repo: ${config.hfRepo}`,
      `Server URL: http://${config.host}:${config.port}`,
      `llama-server: ${config.llamaServerBin ?? "NOT FOUND"}`,
      `llama-mtmd-cli: ${config.llamaMtmdCliBin ?? "NOT FOUND"}`,
      `autoStartServer: ${config.autoStartServer}`,
      "",
    ];

    if (!config.llamaServerBin) {
      lines.push(
        "Action required: set llamaServerBin in ~/.config/opencode/qwen2vl-mcp.json",
        "Example:",
        '  { "llamaServerBin": "D:/llama.cpp/build/bin/Release/llama-server.exe" }',
        "",
        "First run will download the GGUF model from Hugging Face (~1-2 GB).",
      );
      return textResult(lines.join("\n"));
    }

    try {
      const status = config.autoStartServer
        ? await ensureServer(config)
        : await probeServer(config);
      lines.push(
        `Server running: ${status.running}`,
        `Server healthy: ${status.healthy}`,
        `Model loaded: ${status.modelLoaded}`,
        `Managed process: ${status.managed}`,
        `Details: ${status.details}`,
      );
      if (status.healthy && status.modelLoaded) {
        lines.push("", "Ready. Use qwen_describe_image, qwen_ask_image, or qwen_ocr_image.");
      }
    } catch (error) {
      lines.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return textResult(lines.join("\n"));
  },
);

server.tool(
  "qwen_server_status",
  "Check llama-server health for Qwen2-VL without starting it.",
  {},
  async () => {
    const status = await probeServer(config);
    return textResult(
      [
        `baseUrl: ${status.baseUrl}`,
        `running: ${status.running}`,
        `healthy: ${status.healthy}`,
        `modelLoaded: ${status.modelLoaded}`,
        `managed: ${status.managed}`,
        `details: ${status.details}`,
      ].join("\n"),
    );
  },
);

server.tool(
  "qwen_server_stop",
  "Stop the MCP-managed llama-server process. Does not stop externally started servers.",
  {},
  async () => textResult(await stopManagedServer()),
);

const imagePathSchema = z.object({
  image_path: z
    .string()
    .describe("Absolute or relative path to a local image file (png, jpg, webp, gif, bmp)."),
});

server.tool(
  "qwen_describe_image",
  "Describe a local image using Qwen2-VL-2B via llama.cpp. Pair with opencode-vision-tools screenshots.",
  imagePathSchema.shape,
  async ({ image_path }) => {
    const image = await loadImage(image_path);
    const result = await askAboutImage(config, image, PROMPTS.describe);
    return textResult(
      [
        `Image: ${image.absolutePath}`,
        `Size: ${image.sizeBytes} bytes`,
        `Server: ${result.serverUrl}`,
        "",
        result.answer,
      ].join("\n"),
    );
  },
);

server.tool(
  "qwen_ocr_image",
  "Extract visible text from a local image using Qwen2-VL-2B.",
  imagePathSchema.shape,
  async ({ image_path }) => {
    const image = await loadImage(image_path);
    const result = await askAboutImage(config, image, PROMPTS.ocr);
    return textResult(
      [
        `Image: ${image.absolutePath}`,
        `Server: ${result.serverUrl}`,
        "",
        result.answer,
      ].join("\n"),
    );
  },
);

server.tool(
  "qwen_ask_image",
  "Ask a custom question about a local image using Qwen2-VL-2B.",
  {
    ...imagePathSchema.shape,
    question: z.string().describe("Question to ask about the image."),
  },
  async ({ image_path, question }) => {
    const image = await loadImage(image_path);
    const result = await askAboutImage(config, image, question);
    return textResult(
      [
        `Image: ${image.absolutePath}`,
        `Question: ${question}`,
        `Server: ${result.serverUrl}`,
        "",
        result.answer,
      ].join("\n"),
    );
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});