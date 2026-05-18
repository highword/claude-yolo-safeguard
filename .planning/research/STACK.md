# Technology Stack

**Project:** claude-yolo-safeguard
**Researched:** 2026-05-18
**Overall confidence:** HIGH (stack is decided; this document provides rationale and version details)

---

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

**Decision: TypeScript + Bun** because:
1. Claude Code hooks execute as Node.js processes — TypeScript compiles to the exact target runtime
2. Bun eliminates the need for separate build tool (esbuild/webpack), test runner (jest/vitest), and package manager (npm/pnpm)
3. Contributors can jump in immediately — no Rust borrow checker or Go module system to learn
4. The <50ms performance requirement is easily met with synchronous pattern matching in JS/TS
5. npm distribution is the standard for Claude Code ecosystem tooling

**Why not Node.js without Bun:** Node.js alone requires assembling a build toolchain (tsc + esbuild + jest). Bun consolidates all of these into one tool with faster execution.

---

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

---

## 3. Build & Distribution Strategy

### Build: Single-File Bundle via Bun

```typescript
// build.ts
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",       // Output compatible with Node.js >= 18
  format: "cjs",        // CommonJS for maximum hook compatibility
  minify: true,
  sourcemap: "external", // For error reporting, not shipped
  external: [],          // Bundle everything including shell-quote
});
```

**Key decisions:**
- **Target: `node`** — Claude Code spawns hooks as Node.js child processes, not Bun
- **Format: `cjs`** — CommonJS ensures compatibility; Claude Code may `require()` hook scripts
- **Bundle all deps** — Even shell-quote gets inlined; zero runtime install needed after init
- **Single entry point** — One `.cjs` file (~50-100KB) = fast cold start, simple deployment
- **Minify: yes** — Smaller bundle = faster `npx` download, but source maps available for debugging

### Distribution: npm Package with Init Command

```bash
# User installation (one command):
npx claude-yolo-safeguard init

# What init does:
# 1. Detects OS and shell environment
# 2. Copies bundled hook script to ~/.claude/hooks/ (or project-local)
# 3. Registers PreToolUse hook in Claude Code settings
# 4. Creates default config at ~/.config/yolo-safeguard/config.json
# 5. Prints success message with quick-start info
```

**Package structure:**
```
claude-yolo-safeguard/
  dist/
    hook.cjs          # The single-file bundle (runs as hook)
    cli.cjs           # Init command + management CLI
  package.json
  LICENSE
  README.md
```

**npm package.json configuration:**
```json
{
  "name": "claude-yolo-safeguard",
  "bin": {
    "claude-yolo-safeguard": "./dist/cli.cjs"
  },
  "files": ["dist/"],
  "engines": {
    "node": ">=18"
  }
}
```

### Future: Plugin Marketplace

When Claude Code Plugin Marketplace launches, publish as a native plugin. The architecture supports both:
- **npm mode**: User runs `npx claude-yolo-safeguard init` (current)
- **Marketplace mode**: User clicks "Install" in Claude Code UI (future)

Both modes use the same bundled hook script; only the registration path differs.

---

## 4. Claude Code Hook Integration Protocol

### PreToolUse Hook Contract

Claude Code calls hooks as child processes. The hook receives JSON on stdin and communicates decisions via exit code + stdout JSON.

**Input (stdin):**
```json
{
  "hook_type": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "rm -rf /important/data"
  },
  "session_id": "...",
  "cwd": "/path/to/project"
}
```

**Output protocol:**

| Exit Code | Meaning | Stdout |
|-----------|---------|--------|
| 0 | ALLOW — tool use proceeds | Optional JSON with `reason` |
| 2 | BLOCK — tool use is denied | Required JSON with `reason` (shown to user) |

**Stdout JSON for blocking:**
```json
{
  "decision": "block",
  "reason": "CRITICAL: `rm -rf /` would destroy the entire filesystem",
  "severity": "CRITICAL",
  "suggestion": "Use `rm -rf ./specific-dir` to target only the intended directory"
}
```

**Tool matchers (hooks we register):**

| Tool | What We Analyze | Key Patterns |
|------|----------------|--------------|
| `Bash` | `tool_input.command` | Destructive shell commands, dangerous flags, privilege escalation |
| `Write` | `tool_input.file_path` + `tool_input.content` | Sensitive file paths, malicious code patterns in content |
| `Edit` | `tool_input.file_path` + `tool_input.new_string` | Same as Write but for partial edits |

**Performance constraint:** Hook must return within 50ms. Claude Code will timeout slow hooks and proceed (fail-open by design in the platform).

### Hook Registration

```json
// ~/.claude/settings.json (or project .claude/settings.json)
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit",
        "command": "node ~/.claude/hooks/yolo-safeguard/hook.cjs"
      }
    ]
  }
}
```

---

## 5. Cross-Platform Considerations

### The Challenge

Claude Code runs on Windows (PowerShell/cmd), macOS (zsh/bash), and Linux (bash/sh). The Bash tool may contain platform-specific syntax.

### Strategy: Multi-Parser Architecture

| Platform | Shell Syntax | Parser Strategy |
|----------|-------------|-----------------|
| macOS/Linux | POSIX sh/bash/zsh | `shell-quote` library (robust, battle-tested) |
| Windows PowerShell | PowerShell cmdlets + pipelines | Custom lightweight parser (regex-based tokenizer) |
| Windows cmd | CMD builtins + batch | Pattern matching on known dangerous commands |

**Why not a universal parser:**
- POSIX and PowerShell are fundamentally different grammars
- No single npm library handles both correctly
- `shell-quote` is excellent for POSIX but does not understand PowerShell
- A PowerShell AST parser (like `powershell-parser`) would be a heavy dependency

**Recommended approach for Windows:**
1. Detect platform via `process.platform`
2. For PowerShell: tokenize on pipes (`|`), semicolons (`;`), and recognize cmdlet patterns (Verb-Noun)
3. Match against dangerous PowerShell commands: `Remove-Item -Recurse -Force`, `Format-Volume`, `Stop-Process`, `Set-ExecutionPolicy`
4. For cmd.exe: pattern match against `del /f /s /q`, `format`, `rd /s /q`, `reg delete`

**File path normalization:**
```typescript
// Normalize paths for cross-platform rule matching
const normalizePath = (p: string): string =>
  p.replace(/\\/g, "/").toLowerCase();
```

### Node.js Version Requirement

**Minimum: Node.js 18** because:
- Claude Code itself requires Node.js >= 18
- Node 18 provides `structuredClone`, stable `fetch`, improved `child_process`
- Node 16 is EOL; Node 18 is current LTS maintenance (until April 2025 — users should be on 20+ but 18 is safe floor)

### Shell Detection at Init Time

```typescript
// Detect user's shell environment during `init`
function detectShell(): "posix" | "powershell" | "cmd" {
  if (process.platform === "win32") {
    // Check if running in PowerShell or cmd
    return process.env.PSModulePath ? "powershell" : "cmd";
  }
  return "posix";
}
```

---

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

**Rule:** All detection must be rule-based (regex, AST pattern matching, string operations). LLM-based analysis is deferred to v2+ as an optional async post-hoc review, never in the blocking path.

### No Complex State Management

| Rejected | Why Not |
|----------|---------|
| SQLite/better-sqlite3 | Adds native binary dependency; breaks single-file bundle |
| Redis/Memcached | External service dependency for a CLI tool is absurd |
| Level/RocksDB | Native deps, complex setup |

**Instead:** Append-only JSON lines file for audit log. Read config from JSON file at startup. No persistent state between hook invocations (stateless by design).

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

---

## 7. Version Pinning Strategy

```json
// package.json dependency strategy
{
  "dependencies": {
    "shell-quote": "^1.8.1"    // Caret: accept patches, minor bumps OK
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/shell-quote": "^1.7.5",
    "bun-types": "latest"       // Always latest for dev tooling
  }
}
```

**Lockfile:** Use `bun.lockb` (Bun's binary lockfile) for reproducible builds. Committed to repo.

---

## 8. Development Workflow

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run tests in watch mode
bun test --watch

# Lint + format
bunx biome check --write .

# Build single-file bundle
bun run build.ts

# Test the hook locally (simulate Claude Code calling it)
echo '{"hook_type":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | node dist/hook.cjs

# Publish
npm publish
```

---

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

---

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

---

## Installation Commands (Quick Reference)

```bash
# Initialize project
bun init
bun add shell-quote
bun add -d @biomejs/biome @types/shell-quote bun-types typescript

# Biome setup
bunx biome init

# Verify
bun test
bunx biome check .
bun run build.ts
```
