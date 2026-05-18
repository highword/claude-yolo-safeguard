# Architecture Patterns

**Domain:** AI Agent Safety Guardrail (Claude Code Hook Plugin)
**Researched:** 2026-05-18

## Recommended Architecture

A layered, pipeline-based architecture with strict component boundaries. The system is designed as a single-process, synchronous pipeline (no async needed -- must respond in <50ms) with a platform adapter pattern for future multi-tool expansion.

```
+------------------------------------------------------------------+
|                    PLATFORM ADAPTERS (thin)                       |
|  +--------------+  +--------------+  +--------------+            |
|  | Claude Code  |  | Gemini CLI   |  | Codex CLI    |  ...       |
|  | (PreToolUse) |  | (BeforeTool) |  | (PreToolUse) |            |
|  +--------------+  +--------------+  +--------------+            |
+------------------------------------------------------------------+
                            |
                    Normalized Input
                            v
+------------------------------------------------------------------+
|                      CORE ENGINE (platform-agnostic)              |
|                                                                   |
|  +------------------+    +-------------------+    +------------+  |
|  | Router           | -> | Analyzer Pipeline | -> | Classifier |  |
|  | (tool dispatch)  |    | (cmd + content)   |    | (severity) |  |
|  +------------------+    +-------------------+    +------------+  |
|                                                                   |
+------------------------------------------------------------------+
                            |
                    AnalysisResult[]
                            v
+------------------------------------------------------------------+
|                      DECISION ENGINE                              |
|                                                                   |
|  +------------------+    +-------------------+    +------------+  |
|  | Allow-list check | -> | Severity->Action  | -> | Response   |  |
|  | (skip if match)  |    | mapping           |    | Formatter  |  |
|  +------------------+    +-------------------+    +------------+  |
|                                                                   |
+------------------------------------------------------------------+
                            |
                    Decision (allow/block/warn)
                            v
+------------------------------------------------------------------+
|                      OUTPUT LAYER                                 |
|                                                                   |
|  +------------------+    +-------------------+                    |
|  | Platform Output  |    | Audit Logger      |                    |
|  | (stdout JSON)    |    | (JSONL append)    |                    |
|  +------------------+    +-------------------+                    |
|                                                                   |
+------------------------------------------------------------------+
```

## Component Boundaries

### Layer 1: Platform Adapters

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `adapters/claude-code.ts` | Parse Claude Code PreToolUse stdin JSON, emit stdout JSON (exit 0 = allow, exit 2 = block) | Router |
| `adapters/gemini.ts` | (Future) Parse Gemini BeforeTool protocol | Router |
| `adapters/codex.ts` | (Future) Parse Codex PreToolUse protocol | Router |

Each adapter:
1. Reads raw stdin JSON from the platform
2. Normalizes to a `HookInput` interface
3. Passes to the Core Engine
4. Receives a `Decision` and translates it back to platform-specific output

```typescript
// Normalized input interface
interface HookInput {
  tool: 'Bash' | 'Write' | 'Edit';
  command?: string;        // For Bash: the shell command
  filePath?: string;       // For Write/Edit: target file path
  content?: string;        // For Write/Edit: file content or diff
  cwd: string;            // Working directory
  platform: 'claude-code' | 'gemini' | 'codex' | 'cursor' | 'windsurf';
}

// Claude Code specific input (raw from stdin)
interface ClaudeCodeHookEvent {
  hook_type: 'PreToolUse';
  tool_name: 'Bash' | 'Write' | 'Edit';
  tool_input: {
    command?: string;      // Bash
    file_path?: string;    // Write/Edit
    content?: string;      // Write
    old_string?: string;   // Edit
    new_string?: string;   // Edit
  };
}
```

### Layer 2: Core Analysis Engine

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `engine/router.ts` | Dispatch to correct analyzer based on `tool` type | CommandAnalyzer, ContentAnalyzer |
| `engine/command-analyzer.ts` | Parse shell commands, segment pipelines, match rules | RuleEngine |
| `engine/content-analyzer.ts` | Scan file content for security patterns | RuleEngine |
| `engine/classifier.ts` | Assign severity level based on matched rules | Decision Engine |

#### Command Analyzer (Bash tool)

The command analyzer handles the most complex parsing:

```
Raw command string
    |
    v
+-------------------+
| Shell Detector    |  Detect: POSIX sh/bash, PowerShell, cmd, chained (&&, ||, |, ;)
+-------------------+
    |
    v
+-------------------+
| Command Segmenter |  Split pipelines/chains into individual commands
+-------------------+  Handle: subshells $(), backticks, heredocs, semicolons
    |
    v
+-------------------+
| Token Extractor   |  For each segment: extract program + arguments
+-------------------+  Handle: env vars, aliases, path prefixes
    |
    v
+-------------------+
| Rule Matcher      |  Match tokens against rule database
+-------------------+  Context-aware: "rm -rf /" vs "echo 'rm -rf /'"
    |
    v
AnalysisResult[]
```

Key design decisions for command parsing:
- Use `shell-quote` for POSIX parsing (proven, used by safety-net)
- Custom lightweight PowerShell tokenizer (no good npm package exists)
- Recursive parsing for nested commands: `bash -c "rm -rf /"`, `eval "..."`, `sh -c "..."`
- String literal detection to reduce false positives (content inside quotes that are arguments to echo/printf/log/write should not trigger)

#### Content Analyzer (Write/Edit tools)

```
File content or diff
    |
    v
+-------------------+
| File Type Detect  |  Infer language from file extension
+-------------------+
    |
    v
+-------------------+
| Pattern Scanner   |  Run language-appropriate pattern sets
+-------------------+  Categories: XSS, SQLi, secrets, eval, crypto
    |
    v
+-------------------+
| Context Filter    |  Reduce false positives
+-------------------+  Skip: comments, test files, string literals in safe contexts
    |
    v
AnalysisResult[]
```

### Layer 3: Rule System

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `rules/builtin.ts` | Hardcoded rules that cannot be disabled | Command/Content Analyzer |
| `rules/custom.ts` | User-defined additional rules from config | Command/Content Analyzer |
| `rules/allowlist.ts` | Exception patterns that override matches | Decision Engine |
| `rules/types.ts` | Rule type definitions and interfaces | All rule components |

```typescript
interface Rule {
  id: string;                          // e.g., "shell.rm-recursive"
  category: 'shell' | 'content' | 'path';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  pattern: RegExp | ((input: AnalysisContext) => boolean);
  description: string;
  suggestion?: string;                 // Safe alternative
  platforms?: ('posix' | 'powershell' | 'cmd')[];
  builtin: boolean;                    // Cannot be disabled if true
}

interface AllowListEntry {
  id: string;
  match: {
    command?: string | RegExp;         // Command pattern to allow
    filePath?: string | RegExp;        // File path pattern to allow
    ruleId?: string;                   // Specific rule to suppress
    project?: string;                  // Only in this project
  };
  reason: string;                      // Why this is allowed
  expires?: string;                    // ISO date - auto-expire
}
```

Rule priority (highest wins):
1. Allow-list match -> ALLOW (skip all further checks)
2. Built-in CRITICAL rule match -> BLOCK (cannot be overridden)
3. Custom rule match -> severity determines action
4. Built-in non-CRITICAL rule match -> severity determines action
5. No match -> ALLOW

### Layer 4: Decision Engine

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `decision/engine.ts` | Map severity to action, apply config overrides | Response Formatter |
| `decision/formatter.ts` | Generate human-readable messages for stderr | Platform Adapter |
| `decision/logger.ts` | Append decision record to audit log | Filesystem |

```typescript
// Default severity-to-action mapping (configurable)
const DEFAULT_ACTIONS: Record<Severity, Action> = {
  CRITICAL: 'block',    // Hard stop, must manually approve
  HIGH:     'block',    // Block with suggestion
  MEDIUM:   'warn',     // Allow but show warning
  LOW:      'log',      // Silent, only in audit log
};

interface Decision {
  action: 'allow' | 'block' | 'warn' | 'log';
  severity?: Severity;
  matchedRules: string[];
  message?: string;       // Human-readable explanation
  suggestion?: string;    // Safe alternative command
  timestamp: string;
}
```

### Layer 5: Configuration

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `config/loader.ts` | Merge config from all sources | All components |
| `config/schema.ts` | Validate config structure | Loader |
| `config/defaults.ts` | Default configuration values | Loader |

Config resolution order (later overrides earlier):
1. Built-in defaults (hardcoded)
2. User-level: `~/.claude-yolo-safeguard/config.json`
3. Project-level: `.safeguard.json` (in project root)
4. Environment variables: `SAFEGUARD_*` prefix

```typescript
interface Config {
  severity_actions: Record<Severity, Action>;  // Override default mappings
  custom_rules: Rule[];                        // Additional rules
  allow_list: AllowListEntry[];                // Exceptions
  logging: {
    enabled: boolean;
    path: string;                              // Default: ~/.claude-yolo-safeguard/audit.jsonl
    max_size_mb: number;                       // Log rotation threshold
  };
  platforms: {
    powershell: boolean;                       // Enable PS parsing (auto-detected)
  };
}
```

### Layer 6: Output

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `output/stdout.ts` | Platform-specific JSON to stdout | Process stdout |
| `output/stderr.ts` | Human-readable messages to stderr | Process stderr |
| `output/audit.ts` | JSONL log entries | Filesystem |

Claude Code output protocol:
- **Allow:** `{"decision": "allow"}` to stdout, exit code 0
- **Block:** `{"decision": "block", "reason": "..."}` to stdout, exit code 2
- **Warn:** `{"decision": "allow"}` to stdout (allows through), warning to stderr, exit code 0

## Data Flow Diagram (Complete)

```
Claude Code (YOLO mode)                     User Terminal
        |                                        ^
        | stdin: JSON                            | stderr: warnings/blocks
        v                                        |
+-------+----------------------------------------+-------+
|                  ENTRY POINT (index.ts)                 |
|                                                         |
|  1. Read stdin (entire JSON payload)                    |
|  2. Platform adapter: parse -> HookInput                |
|  3. Config loader: merge all config sources             |
+---------------------------+-----------------------------+
                            |
                            v
+---------------------------+-----------------------------+
|                  ROUTER (engine/router.ts)              |
|                                                         |
|  if tool === 'Bash':                                    |
|      -> CommandAnalyzer.analyze(input.command)           |
|  if tool === 'Write':                                   |
|      -> ContentAnalyzer.analyze(input.content, path)    |
|  if tool === 'Edit':                                    |
|      -> ContentAnalyzer.analyze(input.new_string, path) |
|      + CommandAnalyzer if editing shell scripts         |
+---------------------------+-----------------------------+
                            |
                            v  AnalysisResult[]
+---------------------------+-----------------------------+
|                  DECISION ENGINE                        |
|                                                         |
|  1. Check allow-list -> skip if matched                 |
|  2. Find highest severity from results                  |
|  3. Map severity -> action (from config)                |
|  4. Generate message + suggestion                       |
|  5. Log to audit trail                                  |
+---------------------------+-----------------------------+
                            |
                            v  Decision
+---------------------------+-----------------------------+
|                  OUTPUT                                  |
|                                                         |
|  stdout: {"decision": "allow"|"block", ...}             |
|  stderr: "[SAFEGUARD] BLOCKED: rm -rf / ..."           |
|  exit:   0 (allow) | 2 (block)                         |
|  audit:  append to ~/.claude-yolo-safeguard/audit.jsonl |
+---------------------------------------------------------+
```

## Detailed Data Flow Example

### Example 1: Bash command `rm -rf /`

```
stdin: {"hook_type":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf /"}}
  |
  v
[Claude Code Adapter] -> HookInput { tool: 'Bash', command: 'rm -rf /', cwd: '/home/user/project' }
  |
  v
[Router] -> CommandAnalyzer
  |
  v
[Shell Detector] -> POSIX
  |
  v
[Command Segmenter] -> ['rm -rf /'] (single segment)
  |
  v
[Token Extractor] -> { program: 'rm', args: ['-rf', '/'] }
  |
  v
[Rule Matcher] -> Match: rule "shell.rm-recursive-root" (CRITICAL)
  |
  v
[Decision Engine] -> CRITICAL -> block
  |
  v
[Formatter] -> "BLOCKED: Recursive deletion of root filesystem. Use 'rm -rf ./specific-dir' instead."
  |
  v
stdout: {"decision":"block","reason":"Recursive deletion of root filesystem"}
stderr: [SAFEGUARD CRITICAL] BLOCKED: rm -rf /
        Reason: Recursive deletion of root filesystem
        Suggestion: Use 'rm -rf ./specific-dir' instead
exit 2
```

### Example 2: Write tool with hardcoded secret

```
stdin: {"hook_type":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"src/config.ts","content":"const API_KEY = 'sk-abc123...'"}}
  |
  v
[Claude Code Adapter] -> HookInput { tool: 'Write', filePath: 'src/config.ts', content: '...' }
  |
  v
[Router] -> ContentAnalyzer
  |
  v
[File Type Detect] -> TypeScript
  |
  v
[Pattern Scanner] -> Match: rule "content.hardcoded-secret" (HIGH)
  |
  v
[Context Filter] -> Not in comment, not in test file -> confirmed match
  |
  v
[Decision Engine] -> HIGH -> block
  |
  v
stdout: {"decision":"block","reason":"Hardcoded API secret detected"}
stderr: [SAFEGUARD HIGH] BLOCKED: Writing hardcoded secret to src/config.ts
        Suggestion: Use environment variable: process.env.API_KEY
exit 2
```

## Patterns to Follow

### Pattern 1: Pipeline Architecture (Synchronous)

**What:** Each component transforms data and passes to the next. No async, no event loops.
**Why:** Predictable performance under 50ms constraint. Easy to test in isolation.
**Example:**

```typescript
// Each stage is a pure function (or near-pure)
export function analyze(input: HookInput, config: Config): Decision {
  const results = route(input);          // Stage 1: Route to analyzer
  const classified = classify(results);  // Stage 2: Assign severities
  const decision = decide(classified, config); // Stage 3: Map to action
  return decision;
}
```

### Pattern 2: Platform Adapter (Strategy Pattern)

**What:** Thin adapters that normalize platform-specific protocols into a common interface.
**Why:** Adding a new platform means writing only ~100-200 lines of adapter code.
**Example:**

```typescript
// adapter interface
interface PlatformAdapter {
  parse(stdin: string): HookInput;
  formatOutput(decision: Decision): { stdout: string; exitCode: number };
}

// Claude Code adapter
export const claudeCodeAdapter: PlatformAdapter = {
  parse(stdin: string): HookInput {
    const event = JSON.parse(stdin) as ClaudeCodeHookEvent;
    return {
      tool: event.tool_name,
      command: event.tool_input.command,
      filePath: event.tool_input.file_path,
      content: event.tool_input.content ?? event.tool_input.new_string,
      cwd: process.cwd(),
      platform: 'claude-code',
    };
  },
  formatOutput(decision: Decision) {
    if (decision.action === 'block') {
      return { stdout: JSON.stringify({ decision: 'block', reason: decision.message }), exitCode: 2 };
    }
    return { stdout: JSON.stringify({ decision: 'allow' }), exitCode: 0 };
  },
};
```

### Pattern 3: Rule Composition (Declarative Rules)

**What:** Rules as data, not logic. Pattern + metadata, evaluated uniformly.
**Why:** Easy to add/remove/configure. Users can add custom rules in the same format.
**Example:**

```typescript
export const BUILTIN_RULES: Rule[] = [
  {
    id: 'shell.rm-recursive-root',
    category: 'shell',
    severity: 'CRITICAL',
    pattern: /^rm\s+.*-[a-zA-Z]*r[a-zA-Z]*f?[a-zA-Z]*\s+\//,
    description: 'Recursive deletion from root or near-root path',
    suggestion: 'Use a specific subdirectory path instead of /',
    platforms: ['posix'],
    builtin: true,
  },
  {
    id: 'shell.git-force-push-main',
    category: 'shell',
    severity: 'CRITICAL',
    pattern: (ctx) => /git\s+push\s+.*--force/.test(ctx.command!) &&
                      /(main|master)/.test(ctx.command!),
    description: 'Force push to main/master branch',
    suggestion: 'Use --force-with-lease or push to a feature branch',
    platforms: ['posix', 'powershell'],
    builtin: true,
  },
];
```

### Pattern 4: Fail-Open Default

**What:** If the safeguard itself encounters an error (parse failure, config corruption), it allows the operation through rather than blocking.
**Why:** A broken safety tool that blocks everything will be immediately uninstalled. False negatives are tolerable; false positives cause uninstalls.
**Implementation:**

```typescript
try {
  const decision = analyze(input, config);
  output(decision);
} catch (error) {
  // Log error to audit, but allow the operation
  logError(error);
  process.stdout.write(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}
```

### Pattern 5: Single-File Bundle Distribution

**What:** Build to a single JavaScript file with Bun's bundler. No node_modules at runtime.
**Why:** Fast startup (no module resolution), simple install, minimal attack surface.

```
src/
  index.ts              <- Entry point
  adapters/             <- Platform adapters
  engine/               <- Core analysis
  rules/                <- Rule definitions
  decision/             <- Decision logic
  config/               <- Configuration
  output/               <- Response formatting
        |
        | bun build --target=node --minify
        v
dist/
  index.js              <- Single bundled file (~50-100KB)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Async/Event-Driven Processing

**What:** Using async operations, event emitters, or promises for the analysis pipeline.
**Why bad:** Adds unpredictable latency. A PreToolUse hook must respond synchronously and quickly. No network calls, no file reads during analysis (config is pre-loaded at startup).
**Instead:** Pure synchronous pipeline. Read config once at process start, then analyze in-memory.

### Anti-Pattern 2: Full AST Parsing for Commands

**What:** Building a complete AST of shell commands using a full grammar parser.
**Why bad:** Overkill for security checks. Slow (parsers like bash-parser add 20-50ms). Fragile across shell dialects.
**Instead:** Lightweight tokenization + regex pattern matching. Good enough for security detection. The competitor (safety-net) proves this approach works with 1,342 stars.

### Anti-Pattern 3: Stateful Session Tracking

**What:** Tracking command history across invocations for context.
**Why bad:** Each hook invocation is a separate process. Maintaining state requires file I/O on every call, adding latency and complexity.
**Instead:** Stateless analysis per invocation. Each command is evaluated independently. The audit log provides historical record but is write-only during analysis.

### Anti-Pattern 4: Dynamic Rule Loading from Network

**What:** Fetching rule updates from a remote server.
**Why bad:** Adds latency, network dependency, and attack vector. A compromised rule server could disable all protections.
**Instead:** Rules are bundled at build time. Updates come via npm package updates.

### Anti-Pattern 5: Over-Prompting (Warn on Everything)

**What:** Setting too many rules to HIGH/CRITICAL severity.
**Why bad:** Users experience "alert fatigue" and uninstall the tool. This is the #1 failure mode of security tools.
**Instead:** CRITICAL is reserved for truly irreversible operations. Most rules should be MEDIUM (warn) or LOW (log). The graduated system exists to prevent this.

## Directory Structure

```
claude-yolo-safeguard/
|-- src/
|   |-- index.ts                    # Entry point: read stdin, run pipeline, write stdout
|   |-- types.ts                    # Shared type definitions
|   |
|   |-- adapters/
|   |   |-- index.ts                # Adapter registry + auto-detection
|   |   |-- claude-code.ts          # Claude Code PreToolUse adapter
|   |   +-- types.ts                # Platform-specific types
|   |
|   |-- engine/
|   |   |-- router.ts               # Route to correct analyzer by tool type
|   |   |-- command-analyzer.ts     # Shell command analysis pipeline
|   |   |-- content-analyzer.ts     # File content security analysis
|   |   |-- classifier.ts           # Severity assignment
|   |   +-- shell/
|   |       |-- posix-parser.ts     # POSIX shell tokenization (wraps shell-quote)
|   |       |-- powershell-parser.ts # PowerShell tokenization (custom)
|   |       +-- segmenter.ts        # Pipeline/chain splitting
|   |
|   |-- rules/
|   |   |-- index.ts                # Rule registry (builtin + custom merged)
|   |   |-- builtin/
|   |   |   |-- shell-critical.ts   # rm -rf /, DROP DATABASE, etc.
|   |   |   |-- shell-high.ts       # git force-push, chmod 777, etc.
|   |   |   |-- shell-medium.ts     # curl | sh, wget piped, etc.
|   |   |   |-- content-critical.ts # Hardcoded secrets, private keys
|   |   |   |-- content-high.ts     # eval(), innerHTML, SQL injection
|   |   |   +-- content-medium.ts   # Deprecated APIs, weak crypto
|   |   |-- custom.ts              # Load user-defined rules from config
|   |   |-- allowlist.ts           # Allow-list evaluation
|   |   +-- types.ts               # Rule interfaces
|   |
|   |-- decision/
|   |   |-- engine.ts              # Severity -> action mapping
|   |   |-- formatter.ts           # Human-readable message generation
|   |   +-- logger.ts             # JSONL audit log writer
|   |
|   |-- config/
|   |   |-- loader.ts             # Multi-source config merger
|   |   |-- schema.ts             # Config validation
|   |   +-- defaults.ts           # Default configuration
|   |
|   +-- output/
|       |-- stdout.ts             # JSON response to stdout
|       +-- stderr.ts             # Colored messages to stderr
|
|-- tests/
|   |-- unit/
|   |   |-- command-analyzer.test.ts
|   |   |-- content-analyzer.test.ts
|   |   |-- decision-engine.test.ts
|   |   +-- config-loader.test.ts
|   |-- integration/
|   |   |-- claude-code-hook.test.ts
|   |   +-- full-pipeline.test.ts
|   +-- fixtures/
|       |-- commands/              # Test command inputs
|       +-- content/              # Test file content inputs
|
|-- dist/
|   +-- index.js                  # Single bundled output
|
|-- package.json
|-- tsconfig.json
|-- biome.json
+-- bunfig.toml
```

## Build Order (Implementation Dependencies)

Implementation should follow this dependency order. Components at the same level can be built in parallel.

```
Level 0 (Foundation - no dependencies):
  [types.ts] [config/defaults.ts] [config/schema.ts] [rules/types.ts]

Level 1 (Core utilities - depends on Level 0):
  [config/loader.ts] [rules/builtin/*] [output/stderr.ts] [output/stdout.ts]

Level 2 (Parsers - depends on Level 0):
  [engine/shell/posix-parser.ts] [engine/shell/powershell-parser.ts]
  [engine/shell/segmenter.ts]

Level 3 (Analyzers - depends on Level 1 + 2):
  [engine/command-analyzer.ts] [engine/content-analyzer.ts]
  [rules/allowlist.ts] [rules/custom.ts]

Level 4 (Engine - depends on Level 3):
  [engine/router.ts] [engine/classifier.ts]
  [decision/engine.ts] [decision/formatter.ts] [decision/logger.ts]

Level 5 (Adapters - depends on Level 4):
  [adapters/claude-code.ts] [adapters/index.ts]

Level 6 (Entry point - depends on everything):
  [src/index.ts]
```

### Suggested Implementation Phases

**Phase 1: Minimal Viable Hook (shell commands only)**
- Types + config defaults + config loader
- POSIX parser + segmenter + command analyzer
- Built-in shell rules (CRITICAL + HIGH only)
- Decision engine + formatter
- Claude Code adapter + entry point
- Result: Can block `rm -rf /`, `DROP DATABASE`, `git push --force main`

**Phase 2: Content Analysis + PowerShell**
- Content analyzer
- Built-in content rules (secrets, XSS, SQLi, eval)
- PowerShell parser
- Allow-list system
- Result: Full Write/Edit coverage, Windows support

**Phase 3: Polish + Distribution**
- Audit logger (JSONL)
- Custom rule loading
- Project-level config (.safeguard.json)
- `npx claude-yolo-safeguard init` installer
- Single-file bundle optimization
- Result: Ready for npm publish

## Scalability Considerations

| Concern | Current (v0.1) | Scale (100+ rules) | Future (multi-platform) |
|---------|----------------|---------------------|-------------------------|
| Rule matching | Linear scan | Pre-compiled regex map by category | Same (rules are O(n) but n is small) |
| Startup time | ~5ms (parse config) | ~10ms (more rules to load) | ~10ms (adapters are lazy-loaded) |
| Analysis time | ~2-10ms per command | ~10-20ms (more patterns) | Same (analysis is platform-agnostic) |
| Bundle size | ~30KB | ~60KB | ~80KB (more adapters) |
| Memory | ~5MB (Node baseline) | ~8MB (regex cache) | ~10MB |

Performance budget: Total hook latency must stay under 50ms. Current estimates show 15-25ms for typical operations, leaving comfortable headroom.

## Sources

- Claude Code hooks documentation: PreToolUse hook protocol (stdin JSON, exit code 0/2)
- `claude-code-safety-net` (GitHub, 1,342 stars): Validated architecture approach (single-file, shell-quote for POSIX, synchronous pipeline)
- `shell-quote` npm package: Proven POSIX shell command parser, minimal dependency
- Claude Code `.claude/settings.local.json`: Hook registration format
- Multi-platform expansion seed: Hook protocols for Gemini, Codex, Cursor, Windsurf
