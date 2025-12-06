# 🔍 llm-debug

A simple Flask proxy for OpenAI-compatible APIs that logs all requests and responses.

## ✨ Features

- Proxies all `/v1/*` endpoints to upstream provider
- Forwards Authorization headers
- Logs request/response pairs to timestamped JSON files
- Best-effort logging on errors

## 🚀 Quick Start

```bash
cp env.sample .env
# edit .env with your OPENAI_BASE_URL
docker compose up -d
```

Then point your client to `http://localhost:5000/v1/`.

## 🔌 Supported Endpoints

- `/v1/models` - List models
- `/v1/chat/completions` - Chat (including tools, vision)
- `/v1/completions` - Legacy completions
- `/v1/embeddings` - Embeddings

## 📁 Logs

Logs are written to `logs/` as `YYYY-MM-DD_HH-MM-SS-ffffff.json`:

```json
{
  "request": { "method": "...", "url": "...", "headers": {}, "body": {} },
  "response": { "status_code": 200, "headers": {}, "body": {}, "error": null }
}
```

## 📚 Examples

See [`examples/`](examples/) for sample request/response logs:

| File | Description |
|------|-------------|
| [`models.json`](examples/models.json) | GET /v1/models |
| [`chat-completions.json`](examples/chat-completions.json) | Basic chat completion |
| [`chat-tools.json`](examples/chat-tools.json) | Chat with tool/function calling |
| [`chat-vision.json`](examples/chat-vision.json) | Chat with image input |
| [`completions-legacy.json`](examples/completions-legacy.json) | Legacy completions API |
| [`embeddings.json`](examples/embeddings.json) | Text embeddings |

## 🔐 Field Reference

See [FIELDS.md](FIELDS.md) for a complete breakdown of request/response fields:

- Which fields are user-controlled vs response-controlled
- Which fields contain sensitive data requiring encryption
- Encryption strategy for secure transport
