# Check AI Free MCP Server

[![npm version](https://img.shields.io/npm/v/checkaifree-mcp.svg)](https://www.npmjs.com/package/checkaifree-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Check AI Free](https://img.shields.io/badge/Web-checkaifree.com-emerald.svg)](https://checkaifree.com)

Official **Model Context Protocol (MCP)** server for [Check AI Free](https://checkaifree.com) — the 100% free, private in-browser AI image and C2PA provenance detector.

Connects directly to **Claude Desktop**, **Cursor**, **Cline**, **Windsurf**, and any AI agent framework implementing the [Model Context Protocol](https://modelcontextprotocol.io).

---

## ✨ Features

* 🤖 **AI Image Detection**: Identifies generative signatures from **Flux 1.1 Pro**, **Midjourney v5/v6**, **DALL·E 3**, **Stable Diffusion XL**, and synthetic facial deepfakes.
* 🛡️ **C2PA & Provenance Inspection**: Verifies cryptographic C2PA / Content Authenticity Initiative (CAI) manifests and camera hardware EXIF tags.
* 🔒 **Zero API Keys & Privacy-Preserving**: No API keys, accounts, or paid plans required.
* 🌐 **Multiple Input Types**: Analyze images by **public web URL**, **local disk path**, or **Base64 string**.

---

## 🛠️ Available Tools

### 1. `detect_ai_image`
Analyzes an image to determine whether it is synthetic/AI-generated or authentic photography.

**Arguments:**
* `image_url` *(optional, string)*: Direct public HTTP/HTTPS URL of the image.
* `file_path` *(optional, string)*: Absolute or relative local path to the image (`.jpg`, `.jpeg`, `.png`, `.webp`).
* `image_base64` *(optional, string)*: Base64-encoded image string.

**Example Response:**
```markdown
### 🤖 Check AI Free Detection Result

* **Verdict**: **Likely AI-Generated**
* **AI Probability**: **94%**
* **Confidence**: **HIGH**
* **Image Dimensions**: 1024 × 1024 (image/png)

#### Forensic Evidence & Signals:
• [NEGATIVE] C2PA manifest contains generative tool identifier: Midjourney v6
• [NEGATIVE] Discrete spatial frequency analysis detects uniform diffusion noise residuals
• [NEGATIVE] Missing camera sensor MakerNotes and PRNU photon noise signature

---
Analyzed via Check AI Free — https://checkaifree.com
```

### 2. `inspect_c2pa_provenance`
Specifically extracts cryptographic C2PA provenance, signing certificate authorities, and tamper-evident history.

**Arguments:**
* `image_url` *(optional, string)*: Public URL of the image.
* `file_path` *(optional, string)*: Local image file path.

---

## 🚀 Quick Start & Installation

No installation is needed if using `npx`.

### 1. Claude Desktop Setup

Add the following to your `claude_desktop_config.json`:

* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "checkaifree": {
      "command": "npx",
      "args": ["-y", "checkaifree-mcp"]
    }
  }
}
```

### 2. Cursor Setup

In Cursor Settings → Features → MCP:
1. Click **+ Add New MCP Server**
2. Name: `checkaifree`
3. Type: `command`
4. Command: `npx -y checkaifree-mcp`

### 3. Cline / Windsurf Setup

Add to your `mcpSettings.json`:
```json
{
  "mcpServers": {
    "checkaifree": {
      "command": "npx",
      "args": ["-y", "checkaifree-mcp"]
    }
  }
}
```

---

## 🧪 Local Development & Build

```bash
git clone https://github.com/hyai-dev/checkaifree-mcp.git
cd checkaifree-mcp

# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Test run locally
node dist/index.js
```

---

## 📖 Related Links & References

* 🌐 Web Application: [https://checkaifree.com](https://checkaifree.com)
* 🔬 Forensic Methodology: [https://checkaifree.com/methodology](https://checkaifree.com/methodology)
* 💼 LinkedIn Profile Picture Checker: [https://checkaifree.com/check/linkedin-profile-picture](https://checkaifree.com/check/linkedin-profile-picture)
* 🎨 Art Contest Submission Checker: [https://checkaifree.com/check/art-contest-submission](https://checkaifree.com/check/art-contest-submission)

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
