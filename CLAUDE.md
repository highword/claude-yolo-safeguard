<!-- GSD:project-start source:PROJECT.md -->
## Project

**claude-yolo-safeguard**

A universal, lightweight AI agent safety guardrail that enables developers to confidently use YOLO/full-auto modes. It transparently intercepts dangerous operations from Claude Code (and future AI tools), providing graduated response (block/confirm/warn/log) with zero configuration required.

**Tagline:** YOLO without fear. Safe for efficiency.

**Core Value:** Users can enable YOLO mode and work at full speed, knowing that truly destructive operations will be caught and stopped before they execute — without any setup burden.

### Constraints

- **Performance**: Core analysis must complete in <50ms — no perceptible latency
- **Dependencies**: ≤3 runtime dependencies — minimize attack surface and install size
- **Bundle size**: Single-file bundle target ~50-100KB
- **Tech stack**: TypeScript + Bun (build/test/bundle) + Biome (lint)
- **Distribution**: npm package with `npx claude-yolo-safeguard init` one-command setup; Plugin Marketplace later
- **Compatibility**: Must work on Windows (PowerShell/cmd), macOS, Linux
- **Zero-config**: Must provide useful protection immediately after install with no configuration
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## 1. Core Runtime & Language
### Why TypeScript + Bun
| Criterion | TypeScript + Bun | Rust | Go | Plain Node.js |
|-----------|-----------------|------|-----|---------------|
| Ecosystem alignment | Claude Code is Node/TS | Foreign ecosystem | Foreign ecosystem | Aligned |
| Build speed | ~50ms incremental | 2-10s | 1-3s | N/A (interpreted) |
| Bundle output | Single .cjs via built-in bundler | Native binary | Native binary | Needs webpack/esbuild |
| Test runner | Built-in `bun test` | cargo test | go test | Needs jest/vitest |
| Contributor barrier | Low (TS devs everywhere) | High (ownership model) | Medium | Low |
| Performance | Sufficient (<50ms target) | Overkill | Overkill | Sufficient |
| Package distribution | npm (native) | Requires binary releases per platform | Requires binary releases per platform | npm (native) |
## 2. Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | 5.5+ | Language | Type safety, IDE support, ecosystem standard |
| Bun | 1.2+ | Runtime/Build/Test/Package Manager | All-in-one toolchain, fastest bundler for single-file output |
### Key Libraries
| Library | Version | Purpose | Why This One |
|---------|---------|---------|--------------|
| shell-quote | ^1.8.1 | POSIX shell command parsing | Industry standard for tokenizing shell commands; used by npm itself; handles pipes, redirects, subshells, quoting correctly |
| @anthropic-ai/claude-code (types only) | latest | Hook protocol type definitions | Type-safe integration with Claude Code PreToolUse schema |
### Dev Dependencies
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @biomejs/biome | ^1.9+ | Lint + Format | Single tool replaces ESLint + Prettier; Rust-speed; opinionated defaults reduce config |
| @types/shell-quote | ^1.7.5 | TypeScript types for shell-quote | Type safety for parser integration |
| bun-types | latest | Bun API type definitions | TypeScript support for Bun-specific APIs |
### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| npm registry | — | Package distribution | Standard channel; `npx` enables zero-install init command |
| GitHub Actions | — | CI/CD | Free for open source; matrix testing across OS/Node versions |
## 3. Build & Distribution Strategy
### Build: Single-File Bundle via Bun
- **Target: `node`** — Claude Code spawns hooks as Node.js child processes, not Bun
- **Format: `cjs`** — CommonJS ensures compatibility; Claude Code may `require()` hook scripts
- **Bundle all deps** — Even shell-quote gets inlined; zero runtime install needed after init
- **Single entry point** — One `.cjs` file (~50-100KB) = fast cold start, simple deployment
- **Minify: yes** — Smaller bundle = faster `npx` download, but source maps available for debugging
### Distribution: npm Package with Init Command
# User installation (one command):
# What init does:
# 1. Detects OS and shell environment
# 2. Copies bundled hook script to ~/.claude/hooks/ (or project-local)
# 3. Registers PreToolUse hook in Claude Code settings
# 4. Creates default config at ~/.config/yolo-safeguard/config.json
# 5. Prints success message with quick-start info
### Future: Plugin Marketplace
- **npm mode**: User runs `npx claude-yolo-safeguard init` (current)
- **Marketplace mode**: User clicks "Install" in Claude Code UI (future)
## 4. Claude Code Hook Integration Protocol
### PreToolUse Hook Contract
| Exit Code | Meaning | Stdout |
|-----------|---------|--------|
| 0 | ALLOW — tool use proceeds | Optional JSON with `reason` |
| 2 | BLOCK — tool use is denied | Required JSON with `reason` (shown to user) |
| Tool | What We Analyze | Key Patterns |
|------|----------------|--------------|
| `Bash` | `tool_input.command` | Destructive shell commands, dangerous flags, privilege escalation |
| `Write` | `tool_input.file_path` + `tool_input.content` | Sensitive file paths, malicious code patterns in content |
| `Edit` | `tool_input.file_path` + `tool_input.new_string` | Same as Write but for partial edits |
### Hook Registration
## 5. Cross-Platform Considerations
### The Challenge
### Strategy: Multi-Parser Architecture
| Platform | Shell Syntax | Parser Strategy |
|----------|-------------|-----------------|
| macOS/Linux | POSIX sh/bash/zsh | `shell-quote` library (robust, battle-tested) |
| Windows PowerShell | PowerShell cmdlets + pipelines | Custom lightweight parser (regex-based tokenizer) |
| Windows cmd | CMD builtins + batch | Pattern matching on known dangerous commands |
- POSIX and PowerShell are fundamentally different grammars
- No single npm library handles both correctly
- `shell-quote` is excellent for POSIX but does not understand PowerShell
- A PowerShell AST parser (like `powershell-parser`) would be a heavy dependency
### Node.js Version Requirement
- Claude Code itself requires Node.js >= 18
- Node 18 provides `structuredClone`, stable `fetch`, improved `child_process`
- Node 16 is EOL; Node 18 is current LTS maintenance (until April 2025 — users should be on 20+ but 18 is safe floor)
### Shell Detection at Init Time
## 6. What NOT to Use (Anti-Stack)
### No Heavy Frameworks
| Rejected | Why Not |
|----------|---------|
| Express/Fastify/Hono | This is not a server — it's a CLI hook that runs per-invocation |
| Zod/Joi/AJK | Schema validation is overkill for fixed input shapes; TypeScript types suffice |
| Commander/Yargs | CLI arg parsing library too heavy for 2-3 subcommands; use minimal custom parser |
| Winston/Pino | Logging framework unnecessary; write directly to a file with `fs.appendFileSync` |
| Inquirer/Prompts | Hook cannot be interactive — it receives stdin JSON and must return immediately |
### No LLM Calls in Hot Path
| Rejected | Why Not |
|----------|---------|
| Anthropic SDK | API call = 200-2000ms latency, far exceeding 50ms budget |
| OpenAI SDK | Same latency problem + adds API key dependency |
| Local LLM (Ollama) | Cold start 1-5s, inference 100-500ms; not viable for hook |
| Embeddings/Vector DB | Semantic search adds 50-200ms; defeats purpose |
### No Complex State Management
| Rejected | Why Not |
|----------|---------|
| SQLite/better-sqlite3 | Adds native binary dependency; breaks single-file bundle |
| Redis/Memcached | External service dependency for a CLI tool is absurd |
| Level/RocksDB | Native deps, complex setup |
### No Bundler Alternatives
| Rejected | Why Not |
|----------|---------|
| webpack | Slow, complex config, overkill for library bundling |
| Rollup | Good but requires separate install; Bun has it built-in |
| esbuild | Excellent but Bun's bundler is equivalent and already available |
| tsup | Wrapper around esbuild; unnecessary indirection when Bun suffices |
| tsc (emit) | No bundling, no minification, outputs many files |
### No Test Framework Alternatives
| Rejected | Why Not |
|----------|---------|
| Jest | Slow startup, complex config, heavy deps |
| Vitest | Good but separate install; Bun test is built-in and faster |
| Mocha + Chai | Requires assembling multiple packages |
| AVA | Less mainstream, no advantage over bun test |
## 7. Version Pinning Strategy
## 8. Development Workflow
# Install dependencies
# Run tests
# Run tests in watch mode
# Lint + format
# Build single-file bundle
# Test the hook locally (simulate Claude Code calling it)
# Publish
## 9. Alternatives Considered (Full Matrix)
| Category | Chosen | Alternative | Why Not |
|----------|--------|-------------|---------|
| Language | TypeScript | Rust | Binary distribution complexity; no ecosystem alignment |
| Language | TypeScript | Go | Same binary issue; less npm ecosystem familiarity |
| Runtime/Build | Bun | Node + esbuild | Extra dependency; slower test runner |
| Lint/Format | Biome | ESLint + Prettier | Two tools, slower, more config |
| Shell Parser | shell-quote | bash-parser | bash-parser is unmaintained, heavier |
| Shell Parser | shell-quote | mvdan-sh (Go) | Wrong language ecosystem |
| Testing | bun test | vitest | Unnecessary separate dep when Bun includes it |
| Package Manager | bun (install) | pnpm | Works, but bun is already required for build/test |
| CLI Framework | Minimal custom | Commander.js | 50KB+ for 3 commands is wasteful |
| Config Format | JSON | YAML/TOML | JSON is native to JS; no parser needed |
## 10. Sources & Confidence
| Claim | Source | Confidence |
|-------|--------|------------|
| Bun bundler supports `target: "node"` + CJS output | Bun official docs, Context7 | HIGH |
| Biome latest is 1.9+ with TS support | Context7 (resolved version 2.2.4 visible) | HIGH |
| shell-quote handles POSIX tokenization correctly | npm registry (1.8.1), widely used by npm CLI itself | HIGH |
| Claude Code PreToolUse hook protocol (exit code 2 = block) | Project exploration notes, competitor analysis | HIGH |
| Claude Code settings.json hook registration format | Project exploration notes | MEDIUM |
| Node.js 18 minimum for Claude Code | Community reports | MEDIUM |
| PowerShell parsing needs custom solution | No quality npm PowerShell parser found | MEDIUM |
| <50ms performance achievable with regex/string ops | Industry standard for pattern matching at this scale | HIGH |
## Installation Commands (Quick Reference)
# Initialize project
# Biome setup
# Verify
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
