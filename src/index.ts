#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const CHECKAIFREE_API_URL = "https://checkaifree.com/api/v1/detect";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface DetectionResponse {
  id: string;
  timestamp: string;
  status: string;
  result: {
    ai_probability: number;
    verdict: "ai_likely" | "human_likely" | "uncertain";
    confidence: "high" | "medium" | "low";
  };
  signals: Array<{
    code?: string;
    label?: string;
    description: string;
    impact: "negative" | "positive" | "neutral";
  }>;
  meta: {
    width?: number;
    height?: number;
    format?: string;
  };
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    return true;
  }
  const parts = host.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

async function getImageBuffer(args: {
  image_url?: string;
  file_path?: string;
  image_base64?: string;
}): Promise<{ buffer: Uint8Array; filename: string; mimeType: string }> {
  if (args.image_base64) {
    let cleanBase64 = args.image_base64.trim();
    let mimeType = "image/jpeg";
    if (cleanBase64.startsWith("data:")) {
      const match = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = match[2];
      }
    }
    const binary = Buffer.from(cleanBase64, "base64");
    if (binary.byteLength > MAX_FILE_SIZE) {
      throw new Error(`Base64 image size (${(binary.byteLength / 1024 / 1024).toFixed(2)} MB) exceeds 10MB limit`);
    }
    return {
      buffer: new Uint8Array(binary),
      filename: "image.jpg",
      mimeType,
    };
  }

  if (args.file_path) {
    const resolvedPath = path.resolve(args.file_path);
    const baseName = path.basename(resolvedPath);

    // Defense against sensitive/hidden files or system traversal
    if (baseName.startsWith(".") || resolvedPath.includes(".ssh") || resolvedPath.includes(".env")) {
      throw new Error(`Access to hidden or sensitive configuration file is denied: ${baseName}`);
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeType = ALLOWED_MIME_TYPES[ext];
    if (!mimeType) {
      throw new Error(
        `Unsupported file extension '${ext}'. Check AI Free only accepts .jpg, .jpeg, .png, and .webp image files.`
      );
    }

    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Specified path is not a file: ${args.file_path}`);
    }
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File size (${(stats.size / 1024 / 1024).toFixed(2)} MB) exceeds 10MB limit`);
    }

    const data = await fs.readFile(resolvedPath);
    return {
      buffer: new Uint8Array(data),
      filename: baseName,
      mimeType,
    };
  }

  if (args.image_url) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(args.image_url);
    } catch {
      throw new Error(`Invalid URL format: ${args.image_url}`);
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS image URLs are supported");
    }

    if (isPrivateHost(parsedUrl.hostname)) {
      throw new Error("Access to private, loopback, or cloud metadata IP addresses is blocked");
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "CheckAIFree-MCP/1.0 (+https://checkaifree.com)",
        Accept: "image/jpeg,image/png,image/webp,image/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download remote image: HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      throw new Error("Remote image exceeds 10MB limit");
    }

    return {
      buffer: new Uint8Array(arrayBuffer),
      filename: path.basename(parsedUrl.pathname) || "remote-image.jpg",
      mimeType: contentType,
    };
  }

  throw new Error("You must provide one of: image_url, file_path, or image_base64");
}

async function analyzeImage(args: {
  image_url?: string;
  file_path?: string;
  image_base64?: string;
}): Promise<DetectionResponse> {
  const { buffer, filename, mimeType } = await getImageBuffer(args);

  const formData = new FormData();
  const blob = new Blob([Buffer.from(buffer)], { type: mimeType });
  formData.append("image", blob, filename);
  formData.append("original_size", buffer.byteLength.toString());
  formData.append("original_mime", mimeType);

  const res = await fetch(CHECKAIFREE_API_URL, {
    method: "POST",
    body: formData,
    headers: {
      "User-Agent": "CheckAIFree-MCP/1.0 (+https://checkaifree.com)",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Check AI Free API error (HTTP ${res.status}): ${errorText}`);
  }

  return (await res.json()) as DetectionResponse;
}

const server = new McpServer({
  name: "checkaifree-mcp",
  version: "1.0.0",
  description: "Official MCP server for Check AI Free (https://checkaifree.com) — Detect AI-generated images & C2PA credentials",
});

server.tool(
  "detect_ai_image",
  "Analyzes an image (via URL, local file path, or base64) to determine whether it is AI-generated (Flux, Midjourney, DALL-E, Stable Diffusion) or authentic photography. Returns probability score, confidence, C2PA status, and forensic signals.",
  {
    image_url: z.string().optional().describe("Direct public HTTP/HTTPS URL of the image to analyze"),
    file_path: z.string().optional().describe("Absolute or relative local file path to an image file (JPEG, PNG, WebP)"),
    image_base64: z.string().optional().describe("Base64 encoded image data string (optional)"),
  },
  async (args) => {
    try {
      const data = await analyzeImage(args);

      let verdictEmoji = "⚠️";
      let verdictLabel = "Inconclusive / Mixed Signals";
      if (data.result.verdict === "ai_likely") {
        verdictEmoji = "🤖";
        verdictLabel = "Likely AI-Generated";
      } else if (data.result.verdict === "human_likely") {
        verdictEmoji = "📷";
        verdictLabel = "Likely Authentic Photograph";
      }

      const rawProb = data.result.ai_probability;
      const probabilityPercent = rawProb <= 1 ? Math.round(rawProb * 100) : Math.round(rawProb);

      const signalsList = data.signals && data.signals.length > 0
        ? data.signals.map((s) => `• [${s.impact.toUpperCase()}] ${s.label ? `**${s.label}**: ` : ""}${s.description}`).join("\n")
        : "• No definitive metadata anomalies detected.";

      const markdown = `
### ${verdictEmoji} Check AI Free Detection Result

* **Verdict**: **${verdictLabel}**
* **AI Probability**: **${probabilityPercent}%**
* **Confidence**: **${data.result.confidence.toUpperCase()}**
* **Image Dimensions**: ${data.meta.width || "N/A"} × ${data.meta.height || "N/A"} (${data.meta.format || "Unknown"})

#### Forensic Evidence & Signals:
${signalsList}

---
*Analyzed via [Check AI Free](https://checkaifree.com) — 100% Free, Private In-Browser AI & C2PA Image Detector.*
`.trim();

      return {
        content: [
          {
            type: "text",
            text: markdown,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown detection error";
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error analyzing image with Check AI Free: ${message}\nVisit https://checkaifree.com to test directly in browser.`,
          },
        ],
      };
    }
  }
);

server.tool(
  "inspect_c2pa_provenance",
  "Inspects cryptographic C2PA / Content Authenticity Initiative (CAI) metadata and camera EXIF credentials to verify tamper-evident digital provenance.",
  {
    image_url: z.string().optional().describe("Direct public URL of the image to inspect for C2PA credentials"),
    file_path: z.string().optional().describe("Local file path to the image on disk"),
  },
  async (args) => {
    try {
      const data = await analyzeImage(args);

      const rawProb = data.result.ai_probability;
      const probabilityPercent = rawProb <= 1 ? Math.round(rawProb * 100) : Math.round(rawProb);

      const c2paSignals = (data.signals || []).filter((s) => {
        const text = `${s.code || ""} ${s.label || ""} ${s.description || ""}`.toLowerCase();
        return (
          text.includes("c2pa") ||
          text.includes("provenance") ||
          text.includes("exif") ||
          text.includes("camera") ||
          text.includes("makernote") ||
          text.includes("hardware")
        );
      });

      const hasC2PA = c2paSignals.some((s) => {
        const text = `${s.code || ""} ${s.label || ""} ${s.description || ""}`.toLowerCase();
        return text.includes("c2pa") || text.includes("content credential");
      });

      const markdown = `
### 🛡️ C2PA & Provenance Metadata Inspection

* **C2PA Credentials Found**: **${hasC2PA ? "YES (Cryptographic Manifest Detected)" : "NO (No C2PA manifest found)"}**
* **Overall AI Probability**: **${probabilityPercent}%**
* **Primary Verdict**: **${data.result.verdict}**

#### Provenance & Hardware Signals:
${
  c2paSignals.length > 0
    ? c2paSignals.map((s) => `• ${s.label ? `**${s.label}**: ` : ""}${s.description}`).join("\n")
    : "• No camera EXIF or C2PA provenance signatures identified."
}

---
*Verification powered by [Check AI Free](https://checkaifree.com/methodology).*
`.trim();

      return {
        content: [
          {
            type: "text",
            text: markdown,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error inspecting C2PA credentials: ${message}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting Check AI Free MCP Server:", err);
  process.exit(1);
});
