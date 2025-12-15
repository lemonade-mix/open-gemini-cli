# open-gemini-cli

AI coding agent for the terminal - with local LLM support.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

Based on Google's [gemini-cli](https://github.com/google-gemini/gemini-cli), extended with local LLM support and additional providers for offline/private use.

## Added Features

- Local LLM support (MLX, llama.cpp, vLLM)
- Additional cloud providers (OpenAI, Anthropic)
- JSON-configurable provider system
- Optional authentication for local use

## Supported Providers

**Local LLMs**

- MLX Server
- llama.cpp
- vLLM

**Cloud Providers**

- OpenAI (GPT-4, GPT-5, Codex)
- Anthropic (Claude Opus, Sonnet, Haiku)
- Google Gemini (original functionality preserved)

## Installation

```bash
git clone https://github.com/limkcreply/open-gemini-cli
cd open-gemini-cli
npm install
npm run build
npm run start
```

Requirements: Node.js 18+

## Usage

### With Local LLM (llama.cpp example)

```bash
# Start your local server first, then:
export LLAMACPP_SERVER_URL="http://localhost:8080"
kaidex --provider llamacpp
```

### With OpenAI

```bash
export OPENAI_API_KEY="your-key"
kaidex --provider gpt-4.1-mini
```

### With Anthropic

```bash
export ANTHROPIC_API_KEY="your-key"
kaidex --provider claude-sonnet
```

### With Google Gemini (original behavior)

```bash
export GEMINI_API_KEY="your-key"
kaidex
```

## Provider Configuration

Providers are configured in `bundle/llmProviders.json`. Add your own:

```json
{
  "providers": {
    "my-local-model": {
      "name": "My Local Model",
      "baseURL": "http://localhost:8080",
      "endpoint": "/v1/chat/completions",
      "format": "openai",
      "streaming": true
    }
  }
}
```

## Features

- File operations (read, write, edit)
- Shell command execution
- Web fetching
- MCP (Model Context Protocol) support
- Conversation checkpointing
- Project context via KAIDEX.md files

## Documentation

See the [docs](./docs) folder for detailed documentation on:

- [Configuration](./docs/cli/configuration.md)
- [Built-in Tools](./docs/tools/index.md)
- [MCP Servers](./docs/tools/mcp-server.md)

## License

Apache 2.0 - Same as the original gemini-cli.

## Credits

Based on [gemini-cli](https://github.com/google-gemini/gemini-cli) by Google.
