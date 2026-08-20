# DCode

**DCode** turns a command-line AI coding agent into a modern, chat-style desktop app — for Windows, macOS, and Linux.

Under the hood it runs on [DCode-Core](https://github.com/Dhanuzh/DCode-Core), a Rust agent engine, wrapped in an Electron UI with conversation history, custom assistants, scheduled tasks, and MCP server support.

Prefer the terminal? Check out [dcode-ai](https://github.com/Dhanuzh/dcode-ai), the single-binary CLI version of the same agent.

## Features

- **Chat-style interface** — talk to your coding agent in a familiar, windowed UI instead of a raw terminal
- **Conversation history & search** — every session is saved locally and searchable; pick up any past conversation where you left off
- **Custom assistants & skills** — configure named assistants with their own system prompt, tools, and skills, and switch between them per task
- **Scheduled tasks** — queue a prompt to run on a cadence without keeping the app open
- **MCP servers** — connect any Model Context Protocol server through the UI, no hand-edited config files
- **Multi-provider models** — bring your own API key for Anthropic, OpenAI, Gemini, and other OpenAI-compatible providers
- **Cross-platform** — native installers for Windows and Linux, with macOS support built in

## Download

Grab the latest installer from the [Releases page](https://github.com/Dhanuzh/DCode/releases/latest):

- **Windows** — `DCode-<version>-win-x64.exe`
- **Linux** — `DCode-<version>-linux-amd64.deb`

## Development

Requirements: Node.js 22+, [bun](https://bun.sh), and [Rust + Cargo](https://rustup.rs) (for building the local backend). See [docs/contributing/development.md](docs/contributing/development.md) for full environment setup.

```bash
bun install
bun run dev
```

### Building installers

```bash
bun run dist:win     # Windows .exe
bun run dist:linux    # Linux .deb
bun run dist:mac      # macOS .dmg / .zip
```

### Testing

```bash
bun run test              # run all tests
bun run test:coverage     # with coverage report
```

## Documentation

- [docs/](docs/README.md) — guides, architecture, and contributor conventions
- [CONTRIBUTING.md](CONTRIBUTING.md) — PR rules, commit format, and local checks before pushing ([中文版](CONTRIBUTING.zh.md))
- [AGENTS.md](AGENTS.md) — project conventions for human and AI contributors

## License

[Apache-2.0](LICENSE)
