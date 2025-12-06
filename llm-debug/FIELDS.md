# OpenAI API Fields Reference

Fields categorized by control origin for encrypted transport design.

## Legend

- **U** = User controlled (client sends)
- **R** = Response controlled (API returns)
- **C** = Config controlled (proxy/environment)
- **S** = Sensitive (should be encrypted)

---

## Request Fields (User → API)

### Envelope

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `method` | U | No | GET, POST, etc. |
| `path` | U | No | `/v1/chat/completions`, etc. |
| `headers.Authorization` | U | **Yes** | Bearer token |
| `headers.Content-Type` | U | No | Usually `application/json` |
| `headers.User-Agent` | U | No | Client identifier |

### Chat Completions (`/v1/chat/completions`)

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `model` | U | No | Model identifier |
| `messages` | U | **Yes** | Array of message objects |
| `messages[].role` | U | No | `system`, `user`, `assistant`, `tool` |
| `messages[].content` | U | **Yes** | Text or multimodal array |
| `messages[].content[].type` | U | No | `text`, `image_url` |
| `messages[].content[].text` | U | **Yes** | Text content |
| `messages[].content[].image_url.url` | U | **Yes** | Image URL or base64 data |
| `messages[].tool_calls` | U | **Yes** | Tool call history |
| `messages[].tool_call_id` | U | No | Reference ID |
| `temperature` | U | No | 0-2 |
| `max_tokens` | U | No | Token limit |
| `top_p` | U | No | Nucleus sampling |
| `frequency_penalty` | U | No | -2 to 2 |
| `presence_penalty` | U | No | -2 to 2 |
| `n` | U | No | Number of completions |
| `stop` | U | No | Stop sequences |
| `stream` | U | No | Boolean |
| `tools` | U | No | Tool definitions |
| `tools[].type` | U | No | `function` |
| `tools[].function.name` | U | No | Function name |
| `tools[].function.description` | U | No | Function description |
| `tools[].function.parameters` | U | No | JSON schema |
| `tool_choice` | U | No | `auto`, `none`, or specific |
| `response_format` | U | No | `{"type": "json_object"}` |
| `seed` | U | No | Reproducibility seed |
| `user` | U | **Yes** | End-user identifier |

### Legacy Completions (`/v1/completions`)

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `model` | U | No | Model identifier |
| `prompt` | U | **Yes** | Text or array of text |
| `max_tokens` | U | No | Token limit |
| `temperature` | U | No | 0-2 |
| `top_p` | U | No | Nucleus sampling |
| `n` | U | No | Number of completions |
| `stop` | U | No | Stop sequences |
| `echo` | U | No | Echo prompt |
| `logprobs` | U | No | Log probabilities |

### Embeddings (`/v1/embeddings`)

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `model` | U | No | Model identifier |
| `input` | U | **Yes** | Text or array of text |
| `encoding_format` | U | No | `float`, `base64` |
| `dimensions` | U | No | Output dimensions |
| `user` | U | **Yes** | End-user identifier |

---

## Response Fields (API → User)

### Chat Completions Response

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `id` | R | No | Unique completion ID |
| `object` | R | No | `chat.completion` |
| `created` | R | No | Unix timestamp |
| `model` | R | No | Actual model used |
| `system_fingerprint` | R | No | Backend config hash |
| `choices` | R | **Yes** | Array of completions |
| `choices[].index` | R | No | Choice index |
| `choices[].finish_reason` | R | No | `stop`, `length`, `tool_calls` |
| `choices[].message.role` | R | No | `assistant` |
| `choices[].message.content` | R | **Yes** | Generated text |
| `choices[].message.tool_calls` | R | **Yes** | Tool call requests |
| `choices[].message.tool_calls[].id` | R | No | Call ID |
| `choices[].message.tool_calls[].type` | R | No | `function` |
| `choices[].message.tool_calls[].function.name` | R | No | Function name |
| `choices[].message.tool_calls[].function.arguments` | R | **Yes** | JSON arguments |
| `usage.prompt_tokens` | R | No | Input tokens |
| `usage.completion_tokens` | R | No | Output tokens |
| `usage.total_tokens` | R | No | Total tokens |
| `usage.cost` | R | No | Cost (provider-specific) |

### Legacy Completions Response

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `id` | R | No | Unique completion ID |
| `object` | R | No | `text_completion` |
| `created` | R | No | Unix timestamp |
| `model` | R | No | Actual model used |
| `choices` | R | **Yes** | Array of completions |
| `choices[].text` | R | **Yes** | Generated text |
| `choices[].index` | R | No | Choice index |
| `choices[].finish_reason` | R | No | `stop`, `length` |
| `choices[].logprobs` | R | No | Token log probs |
| `usage.*` | R | No | Token counts |

### Embeddings Response

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `object` | R | No | `list` |
| `model` | R | No | Actual model used |
| `data` | R | **Yes** | Array of embeddings |
| `data[].object` | R | No | `embedding` |
| `data[].index` | R | No | Input index |
| `data[].embedding` | R | **Yes** | Vector (float array) |
| `usage.prompt_tokens` | R | No | Input tokens |
| `usage.total_tokens` | R | No | Total tokens |

### Models Response (`/v1/models`)

| Field | Control | Sensitive | Notes |
|-------|---------|-----------|-------|
| `object` | R | No | `list` |
| `data` | R | No | Array of models |
| `data[].id` | R | No | Model identifier |
| `data[].object` | R | No | `model` |
| `data[].created` | R | No | Unix timestamp |
| `data[].owned_by` | R | No | Owner |

---

## Response Headers (Notable)

| Header | Control | Sensitive | Notes |
|--------|---------|-----------|-------|
| `x-request-id` | R | No | Request tracking |
| `x-ratelimit-*` | R | No | Rate limit info |
| `openai-organization` | R | No | Org identifier |
| `openai-processing-ms` | R | No | Processing time |
| `x-litellm-*` | R | No | LiteLLM proxy headers |

---

## Encryption Strategy

### Must Encrypt (Request)
- `headers.Authorization`
- `messages[].content` (all forms)
- `prompt`
- `input` (embeddings)
- `user`

### Must Encrypt (Response)
- `choices[].message.content`
- `choices[].text`
- `choices[].message.tool_calls[].function.arguments`
- `data[].embedding`

### Can Leave Plain
- Model identifiers
- Token counts / usage
- Timestamps
- Finish reasons
- Object types
- Non-sensitive headers

---

## Log File Structure

```json
{
  "request": {
    "method": "POST",
    "url": "https://api.example.com/v1/chat/completions",
    "headers": { ... },
    "body": { ... }
  },
  "response": {
    "status_code": 200,
    "headers": { ... },
    "body": { ... },
    "error": null
  }
}
```
