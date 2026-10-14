import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, "dist/index.js");

console.log("🚀 Starting Check AI Free MCP Server test suite...");
console.log(`Server binary: ${serverScript}`);

const child = spawn("node", [serverScript], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const pendingRequests = new Map();
let requestId = 1;

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep last incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line.trim());
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) {
          reject(new Error(`JSON-RPC Error: ${JSON.stringify(msg.error)}`));
        } else {
          resolve(msg.result);
        }
      }
    } catch (e) {
      console.warn("Non-JSON stdout:", line);
    }
  }
});

child.stderr.on("data", (data) => {
  console.error("[MCP SERVER STDERR]:", data.toString("utf8"));
});

function sendRequest(method, params = {}) {
  const id = requestId++;
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify(payload) + "\n");
  });
}

function sendNotification(method, params = {}) {
  const payload = {
    jsonrpc: "2.0",
    method,
    params,
  };
  child.stdin.write(JSON.stringify(payload) + "\n");
}

async function runTests() {
  try {
    // Test 1: Initialize
    console.log("\n--- [Test 1] MCP Initialize Handshake ---");
    const initRes = await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    });
    console.log("✅ Initialize response received:");
    console.log(`  Protocol: ${initRes.protocolVersion}`);
    console.log(`  Server: ${initRes.serverInfo?.name} v${initRes.serverInfo?.version}`);
    sendNotification("notifications/initialized");

    // Test 2: List Tools
    console.log("\n--- [Test 2] List Tools ---");
    const toolsRes = await sendRequest("tools/list", {});
    console.log(`✅ Server exposes ${toolsRes.tools?.length || 0} tools:`);
    for (const tool of toolsRes.tools) {
      console.log(`  • ${tool.name}: ${tool.description.substring(0, 60)}...`);
    }

    if (!toolsRes.tools.some((t) => t.name === "detect_ai_image")) {
      throw new Error("Missing detect_ai_image tool!");
    }
    if (!toolsRes.tools.some((t) => t.name === "inspect_c2pa_provenance")) {
      throw new Error("Missing inspect_c2pa_provenance tool!");
    }

    // Test 3: Local file detection (Midjourney sample)
    console.log("\n--- [Test 3] Local File Detection (Midjourney Sample) ---");
    const samplePath = path.resolve(__dirname, "../public/samples/midjourney-sample.png");
    console.log(`Analyzing local file: ${samplePath}`);
    const localRes = await sendRequest("tools/call", {
      name: "detect_ai_image",
      arguments: {
        file_path: samplePath,
      },
    });
    console.log("✅ Local detection result:");
    console.log(localRes.content?.[0]?.text);

    // Test 4: Remote URL detection
    console.log("\n--- [Test 4] Remote URL Detection (https://checkaifree.com/screenshot.png) ---");
    const remoteRes = await sendRequest("tools/call", {
      name: "detect_ai_image",
      arguments: {
        image_url: "https://checkaifree.com/screenshot.png",
      },
    });
    console.log("✅ Remote detection result:");
    console.log(remoteRes.content?.[0]?.text);

    // Test 5: C2PA Provenance Inspection (Camera sample)
    console.log("\n--- [Test 5] C2PA Provenance Inspection (Camera Sample) ---");
    const cameraPath = path.resolve(__dirname, "../public/samples/camera-sample.jpg");
    const c2paRes = await sendRequest("tools/call", {
      name: "inspect_c2pa_provenance",
      arguments: {
        file_path: cameraPath,
      },
    });
    console.log("✅ C2PA inspection result:");
    console.log(c2paRes.content?.[0]?.text);

    // Test 6: Security Boundary Checks
    console.log("\n--- [Test 6] Security Boundary & Error Handling Checks ---");

    // 6a: Reject non-image file
    console.log("Testing 6a: Reject non-image file (package.json)...");
    const badExtRes = await sendRequest("tools/call", {
      name: "detect_ai_image",
      arguments: {
        file_path: path.resolve(__dirname, "package.json"),
      },
    });
    console.log("6a Result isError:", badExtRes.isError);
    console.log("6a Output text:", badExtRes.content?.[0]?.text);
    if (!badExtRes.isError || !badExtRes.content?.[0]?.text.includes("Unsupported file extension")) {
      throw new Error("Failed to block non-image file extension!");
    }
    console.log("✅ 6a: Successfully blocked non-image file extension.");

    // 6b: Reject private IP SSRF
    console.log("\nTesting 6b: Reject loopback SSRF URL (127.0.0.1)...");
    const ssrfRes = await sendRequest("tools/call", {
      name: "detect_ai_image",
      arguments: {
        image_url: "http://127.0.0.1:8080/test.png",
      },
    });
    console.log("6b Result isError:", ssrfRes.isError);
    console.log("6b Output text:", ssrfRes.content?.[0]?.text);
    if (!ssrfRes.isError || !ssrfRes.content?.[0]?.text.includes("blocked")) {
      throw new Error("Failed to block SSRF loopback address!");
    }
    console.log("✅ 6b: Successfully blocked SSRF loopback address.");

    console.log("\n🎉 ALL TESTS PASSED! The MCP Server is fully operational and reliable.");
    child.kill();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    child.kill();
    process.exit(1);
  }
}

runTests();
