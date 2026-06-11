import { type Qwen2vlConfig, serverBaseUrl } from "./config.js";
import { type LoadedImage } from "./image.js";
import { ensureServer } from "./llama-server.js";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: { message?: string };
};

function extractText(response: ChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  if (response.error?.message) return `Error: ${response.error.message}`;
  return "";
}

export async function askAboutImage(
  config: Qwen2vlConfig,
  image: LoadedImage,
  prompt: string,
): Promise<{ answer: string; serverUrl: string }> {
  const status = await ensureServer(config);
  const baseUrl = serverBaseUrl(config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "qwen2-vl",
        max_tokens: config.maxTokens,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image.dataUrl } },
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as ChatCompletionResponse;
    if (!response.ok) {
      const message = payload.error?.message ?? `HTTP ${response.status}`;
      throw new Error(message);
    }

    const answer = extractText(payload);
    if (!answer) throw new Error("Empty response from Qwen2-VL.");
    return { answer, serverUrl: status.baseUrl };
  } finally {
    clearTimeout(timer);
  }
}

export const PROMPTS = {
  describe:
    "Describe this image in detail. Mention visible UI elements, text, colors, layout, and anything notable.",
  ocr: "Extract all visible text from this image. Preserve line breaks and reading order. If no text is visible, say 'NO_TEXT_FOUND'.",
};