# opencode-qwen2vl-mcp

[![OpenCode MCP](https://img.shields.io/badge/OpenCode-MCP-blue)](https://opencode.ai/docs/mcp-servers/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Local vision MCP for OpenCode** — understand images with **Qwen2-VL-2B** via precompiled **llama.cpp** (`llama-server`).

Pairs with [opencode-vision-tools](https://github.com/stevenke1981/opencode-vision-tools): capture desktop screenshots with `vision*`, then analyze them with `qwen*`.

Repository: https://github.com/stevenke1981/opencode-qwen2vl-mcp

---

## For humans — quick start

### What it does

Runs a local multimodal model and exposes MCP tools so OpenCode can:

- **Describe** what's in a screenshot or image file
- **Ask** custom visual questions (VQA)
- **OCR** visible text from images
- **Diagnose** llama.cpp setup and model load status

All inference stays on your machine. No cloud API key required.

### Prerequisites

| Requirement | Notes |
|-------------|-------|
| **llama.cpp** (multimodal build) | `llama-server.exe` + DLLs in one folder |
| **Node.js 20+** | Runs the MCP server |
| **GPU optional** | CUDA build uses GPU automatically; CPU fallback works |

Default binary location on this machine:

```
~/.config/llama-cpp/llama-server.exe
```

First run downloads `ggml-org/Qwen2-VL-2B-Instruct-GGUF` from Hugging Face (~1–2 GB) into the HF cache.

### Install (global, `~/.config`)

One command clones/updates to `~/.config/opencode-qwen2vl-mcp`, builds there, and registers MCP in `~/.config/opencode/opencode.jsonc`.

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

**macOS / Linux:**

```bash
bash install.sh
```

**Manual:**

```bash
git clone https://github.com/stevenke1981/opencode-qwen2vl-mcp.git ~/.config/opencode-qwen2vl-mcp
cd ~/.config/opencode-qwen2vl-mcp
node scripts/install-global.mjs
```

| Path | Purpose |
|------|---------|
| `~/.config/opencode-qwen2vl-mcp/` | MCP server source + `dist/` |
| `~/.config/opencode/qwen2vl-mcp.json` | llama-server / model settings |

| `~/.config/opencode/opencode.jsonc` | MCP registration |

MCP command uses `$env:USERPROFILE` on Windows and `$HOME` on Linux/macOS (portable across machines).

### Configure

Edit `~/.config/opencode/qwen2vl-mcp.json`:

```json
{
  "llamaServerBin": "C:/Users/steven/.config/llama-cpp/llama-server.exe",
  "llamaMtmdCliBin": "C:/Users/steven/.config/llama-cpp/llama-mtmd-cli.exe",
  "hfRepo": "ggml-org/Qwen2-VL-2B-Instruct-GGUF",
  "host": "127.0.0.1",
  "port": 8188,
  "ctxSize": 8192,
  "gpuLayers": "auto",
  "autoStartServer": true
}
```

Restart OpenCode after install.

### Verify

```bash
opencode run "call qwen_doctor and show the result"
```

Expected when ready:

```
llama-server: C:/Users/steven/.config/llama-cpp/llama-server.exe
Server healthy: true
Model loaded: true
Ready. Use qwen_describe_image, qwen_ask_image, or qwen_ocr_image.
```

Or run locally:

```bash
npm run doctor
npm run verify
```

Fast reinstall (deps already installed):

```bash
node scripts/install-global.mjs --skip-npm
```

### MCP tools

| Tool | Purpose |
|------|---------|
| `qwen_doctor` | Check binary path, config, server + model status |
| `qwen_server_status` | Health probe without auto-starting server |
| `qwen_server_stop` | Stop MCP-managed `llama-server` process |
| `qwen_describe_image` | Describe image content (UI, layout, objects) |
| `qwen_ask_image` | Custom question about an image |
| `qwen_ocr_image` | Extract visible text |

### Typical workflow (with vision-tools)

```
visionCaptureScreen({ path: "screen.png" })
  → qwen_describe_image({ image_path: "screen.png" })
  → qwen_ocr_image({ image_path: "screen.png" })   // if you need exact text
```

### Manual llama-server

If you prefer to manage the server yourself:

```powershell
cd ~/.config/llama-cpp
.\llama-server.exe -hf ggml-org/Qwen2-VL-2B-Instruct-GGUF -c 8192 --port 8188 --no-ui
```

Set `"autoStartServer": false` in `qwen2vl-mcp.json`.

### Environment variables

| Variable | Description |
|----------|-------------|
| `LLAMA_SERVER_BIN` | Path to `llama-server` |
| `LLAMA_MTMD_CLI_BIN` | Path to `llama-mtmd-cli` |
| `QWEN2VL_HF_REPO` | Hugging Face repo (default: `ggml-org/Qwen2-VL-2B-Instruct-GGUF`) |
| `QWEN2VL_PORT` | Server port (default: `8188`) |
| `QWEN2VL_CTX_SIZE` | Context size (default: `8192`) |
| `QWEN2VL_AUTO_START` | `true` / `false` |
| `QWEN2VL_MCP_CONFIG` | Override config file path |

### Related projects

- [opencode-vision-tools](https://github.com/stevenke1981/opencode-vision-tools) — desktop screenshots (`vision*`)
- [opencode-agent-browser](https://github.com/stevenke1981/opencode-agent-browser) — web automation (`browser*`)
- [opencode-git-tools](https://github.com/stevenke1981/git-opencode-plugin) — Git plugin tools

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `llama-server binary not found` | Set `llamaServerBin` in `qwen2vl-mcp.json` |
| Server starts then exits immediately | Run from the folder containing DLLs; MCP sets `cwd` automatically |
| First call very slow | Model download + GPU load; wait up to several minutes |
| MCP timeout | Default 300s in `opencode.jsonc`; increase if needed |
| Port in use | Change `port` in config or stop existing `llama-server` |
| OpenCode cannot connect | Run `npm run doctor`; rerun `node scripts/install-global.mjs` for portable paths |
| Stale path (`Users\eda\` or `~`) | Rerun installer — uses `pwsh` + `$env:USERPROFILE` on Windows |
| Chrome for Testing opens automatically | Old `--no-webui` is deprecated; MCP now passes `--no-ui`. Stop existing `llama-server` and retry |

### License

MIT

---

## For AI agents — operating instructions

<!-- AGENT_README: opencode-qwen2vl-mcp v1.0 -->

You have **qwen\*** MCP tools = OpenCode's **local image understanding** via Qwen2-VL-2B + llama.cpp. **Prefer them** over guessing image content, raw `curl` to localhost, or asking the user to describe screenshots.

### Decision: when to USE qwen*

Use qwen tools if **any** of these is true:

| Signal | Tool |
|--------|------|
| User asks what's in an image / screenshot | `qwen_describe_image` |
| You have a PNG/JPG path from `visionCapture*` or user attachment | `qwen_describe_image` or `qwen_ask_image` |
| Need text from screenshot (labels, errors, UI copy) | `qwen_ocr_image` |
| Custom visual question ("Is the button red?", "What error?") | `qwen_ask_image` |
| First vision task or qwen* failed | `qwen_doctor` |
| Check if llama-server is up | `qwen_server_status` |

**First qwen task in a session:** `qwen_doctor`

**Standard workflow (with opencode-vision-tools):**

```
visionDoctor()
visionCaptureScreen({ path: "screen.png" })
  OR visionCaptureWindow({ query: "AppName", path: "app.png" })
→ qwen_describe_image({ image_path: "screen.png" })
→ qwen_ocr_image({ image_path: "screen.png" })    // when exact text matters
```

Always pass the **absolute or project-relative image path** returned by vision tools.

### Decision: when NOT to use

| Situation | Use instead |
|-----------|-------------|
| Website DOM / HTML content | `browser*` tools |
| Read source code from repo | `Read` / `Grep` / codebase-memory-mcp |
| User did not provide an image and no screenshot was taken | `visionCapture*` first, then qwen* |
| Secrets visible on screen | Only analyze if user explicitly requests; warn about sensitive data |
| Raw API calls to llama-server | Use qwen* MCP tools — they handle server lifecycle |

### Tool reference

| Tool | When | Key args |
|------|------|----------|
| `qwen_doctor` | Setup check; errors; session start | — |
| `qwen_server_status` | Probe health without starting | — |
| `qwen_server_stop` | Stop MCP-managed server | — |
| `qwen_describe_image` | General image understanding | `image_path` |
| `qwen_ask_image` | Targeted VQA | `image_path`, `question` |
| `qwen_ocr_image` | Text extraction | `image_path` |

Supported image types: `png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`.

### Call examples

```javascript
// Diagnose before first use
qwen_doctor()

// Describe a vision-tools screenshot
qwen_describe_image({ image_path: "D:/project/desktop.png" })

// Ask a specific question
qwen_ask_image({
  image_path: "app-ui.png",
  question: "What error message is shown in the dialog?"
})

// Extract on-screen text
qwen_ocr_image({ image_path: "settings.png" })
```

### qwen* vs vision* vs browser*

| Layer | Tools | Target |
|-------|-------|--------|
| **Capture desktop** | `vision*` | Screenshots, windows, native apps |
| **Understand images** | `qwen*` | Local VLM on image files |
| **Web pages** | `browser*` | URLs, DOM, forms |

Pipeline: **vision* captures** → **qwen* understands**.

Do not skip capture: qwen* needs a local `image_path`; it does not screenshot by itself.

### Server behavior

- MCP auto-starts `llama-server` when `autoStartServer: true` (default)
- Binary must live with its DLLs (e.g. `~/.config/llama-cpp/`)
- Model: `ggml-org/Qwen2-VL-2B-Instruct-GGUF`, port `8188`, ctx `8192`
- First load can take minutes (download + GPU warmup); MCP timeout is 300s
- If server already running on configured port, MCP reuses it

### Rules

1. Run `qwen_doctor` before first qwen* use in a session
2. After `visionCapture*`, pass the saved path to `qwen_describe_image`
3. Use `qwen_ocr_image` for text; `qwen_describe_image` for layout/UI overview
4. Do not use bash/curl/PowerShell to call llama-server when qwen* tools exist
5. Report image path + model answer to the user
6. Pair with [opencode-vision-tools](https://github.com/stevenke1981/opencode-vision-tools) for full desktop vision pipeline

<!-- END_AGENT_README -->

---

## Project layout

```
opencode-qwen2vl-mcp/
├── src/
│   ├── index.ts          # MCP server + tool definitions
│   ├── config.ts         # Config + binary discovery
│   ├── llama-server.ts   # Subprocess lifecycle
│   ├── vision.ts         # OpenAI-compatible VLM API calls
│   └── image.ts          # Image loading / base64
├── scripts/
│   ├── install-global.mjs
│   ├── doctor.mjs
│   ├── mcp-command.mjs
│   └── verify.mjs
├── mcps/opencode-qwen2vl-mcp/tools/   # MCP tool schemas
├── config.example.json
├── opencode.json.example
└── install.ps1 / install.sh
```