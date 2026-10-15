# Check AI Free MCP server

Official MCP adapter for [Check AI Free](https://checkaifree.com). It uploads a selected image for source/header inspection and returns editable metadata observations with limitations. It does not verify C2PA signatures, authenticate an origin or identify an exact generator.

## Install

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

Use this stdio configuration in an MCP client that supports local commands. No service API key or account is required; rate limits and availability apply.

## Tools

- `detect_ai_image`: accepts one of `image_url`, `file_path`, or `image_base64`. Read source observations; metadata-only readings do not display a model percentage.
- `inspect_c2pa_provenance`: accepts `image_url` or `file_path`. The historical tool name is retained for compatibility. It observes source markers and camera fields; signatures, asset binding and certificate trust are **not verified**.

Supported inputs: JPEG, PNG and WebP up to 10 MiB. A supplied URL is fetched by this Node process; the selected image bytes and filename are then sent to the Check AI Free backend. Local files and base64 input are also uploaded. This adapter is not an in-browser/local-only checker. Do not supply sensitive images without reviewing [image handling](https://checkaifree.com/privacy).

The current adapter calls the source/header endpoint. It does **not** run the website's separate image re-encoding/pixel-model fallback. Missing metadata can therefore remain inconclusive. Use the [website](https://checkaifree.com/) for the full user-facing flow. Source text is editable; no metadata observation or model estimate is proof of authenticity or account identity.

## Reading example

An illustrative source-only response might say:

> Source text suggests AI generation. No completed model score; source clues alone do not establish a probability. Source fields are editable. C2PA signatures are not verified.

This is an explanation of output semantics, not an accuracy benchmark. The [method page](https://checkaifree.com/methodology) documents the product's capabilities and limits.

## Development and release checks

```sh
npm ci
npm test
npm pack --dry-run
```

The default tests are offline: output semantics, protocol initialization/tool discovery and missing-input rejection. `test:live` retains the legacy integration runner and requires explicit review of its fixtures and network requests before use. Release checks do not need paid provider calls.

Source: [hyai-dev/checkaifree-mcp](https://github.com/hyai-dev/checkaifree-mcp). MIT license; see LICENSE.
