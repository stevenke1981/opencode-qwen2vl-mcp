import fs from "node:fs/promises";
import path from "node:path";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
};

export type LoadedImage = {
  absolutePath: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
};

export async function loadImage(imagePath: string): Promise<LoadedImage> {
  const absolutePath = path.resolve(imagePath);
  const stat = await fs.stat(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) {
    throw new Error(`Unsupported image type '${ext}'. Use png, jpg, jpeg, webp, gif, or bmp.`);
  }

  const buffer = await fs.readFile(absolutePath);
  const base64 = buffer.toString("base64");
  return {
    absolutePath,
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`,
    sizeBytes: buffer.byteLength,
  };
}