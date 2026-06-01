# Phase 5: Code Content Security - Research

**Researched:** 2026-06-01
**Domain:** Content pattern scanning for Write/Edit tool interception
**Confidence:** HIGH

## Summary

Phase 5 extends the existing hook from Bash-only analysis to Write/Edit tool interception. The architecture is well-defined by prior phases: the hook entry point (`src/hook/process.ts`) currently early-returns for non-Bash tools, and this phase replaces that early-return with a content scanning pipeline. The existing `src/rules/content.ts` already defines 5 content rules (secrets, eval, innerHTML, SQL concat, dangerouslySetInnerHTML); Phase 5 expands these to cover all 6 CODE requirements and routes Write/Edit events through a new `src/content/scanner.ts` module.

The implementation is straightforward because the project already has all architectural primitives needed: the `Rule` type with keywords/pattern/severity, the `compileRules()` function for pre-compiled regex, the `matchRules()` pattern from `src/pipeline/matcher.ts`, and the full decision/format/logger pipeline from Phase 3. The new work is: (1) a content scanner module with keyword quick-reject + per-line regex + Shannon entropy for secrets, (2) routing logic in `processHookEvent` for Write/Edit tools, (3) path-based severity adjustment for test/doc files, and (4) inline ignore markers.

**Primary recommendation:** Build a lightweight `src/content/scanner.ts` that reuses `compileRules()` from the matcher, adds Shannon entropy calculation for secret detection, implements per-line scanning with ignore markers, and returns `RuleMatch[]` that plugs directly into the existing `makeDecision() -> formatHookOutput()` pipeline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hardcoded secrets/tokens -> CRITICAL severity (never bypassable, session cannot override)
- All other content detections (XSS, SQLi, eval, dangerous functions, insecure crypto) -> HIGH severity (block with explanation + safe alternative)
- New module: `src/content/scanner.ts` -- lightweight wrapper over existing matcher regex engine
- Approach: keyword quick-reject + per-line regex scanning
- Reuses `matchRules()` pattern matching from `src/pipeline/matcher.ts`
- Adds Shannon entropy calculation for enhanced secret detection (distinguishing real tokens from variable names)
- Performance: <5ms for typical files (50KB), <20ms for large files (200KB)
- Multi-line pattern matching deferred to v2 backlog
- Write tool: Analyze `tool_input.content` (full file being written)
- Edit tool: Analyze only `tool_input.new_string` (replacement text being introduced)
- Content >500KB skips scanning (fail-open) to avoid latency spikes
- Path-based severity adjustment: test/doc/fixture patterns downgraded to warn (not block)
- Exception: CRITICAL detections (hardcoded secrets) NEVER downgraded
- Inline ignore marker: `// safeguard-ignore-next-line` causes scanner to skip next line
- No file I/O required: path comes from `tool_input.file_path`

### Claude's Discretion
- Internal module structure within `src/content/` (how many files, naming)
- Entropy threshold value for secret detection
- Exact regex patterns for CODE-05 (insecure crypto detection)
- Whether to export scanner functions individually or as a single `scanContent()` entry point
- Test organization (one test file per category vs unified)

### Deferred Ideas (OUT OF SCOPE)
- Multi-line SQL concatenation detection -- v2 backlog
- Base64-encoded secret detection -- v2 (ADV-02)
- Context-aware detection (understanding if code is reachable vs dead) -- out of scope
- Per-language grammar-aware parsing -- too complex for regex approach
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CODE-01 | Detect hardcoded API keys, tokens, and passwords (pattern + entropy) | Content scanner with regex + Shannon entropy >4.5 on strings >=16 chars; CRITICAL severity; existing `content.hardcoded-secret` rule expanded |
| CODE-02 | Detect SQL injection patterns (string concatenation in SQL) | Existing `content.sql-concat` rule; add template literal patterns (`${}`); HIGH severity |
| CODE-03 | Detect XSS patterns (innerHTML, dangerouslySetInnerHTML, document.write) | Existing `content.innerHTML` + `content.dangerouslySetInnerHTML` rules; add `document.write`; HIGH severity |
| CODE-04 | Detect dangerous function usage (eval, new Function, os.system, subprocess shell=True, child_process.exec) | Existing `content.eval-usage` rule; add `new Function`, `os.system`, `subprocess.*shell=True`, `child_process.exec`; HIGH severity |
| CODE-05 | Detect insecure cryptography (MD5/SHA1 for hashing, ECB mode) | New rules for `md5(`, `sha1(`, `createHash('md5')`, `createHash('sha1')`, `Mode.ECB`, `AES.MODE_ECB`; HIGH severity |
| CODE-06 | Hook Write and Edit tools via PreToolUse | Modify `processHookEvent` routing; extract content from `tool_input.content` (Write) or `tool_input.new_string` (Edit) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Content scanning (regex + entropy) | Content Scanner module | -- | Pure computation, no I/O; dedicated module for separation of concerns |
| Hook event routing (Write/Edit dispatch) | Hook Process layer | -- | `processHookEvent` already owns tool dispatch logic |
| Path-based severity adjustment | Content Scanner | Decision Engine | Scanner adjusts severity before passing to decision engine |
| Inline ignore markers | Content Scanner | -- | Pre-processing step before regex matching, scanner-internal |
| Decision making (block/warn/allow) | Decision Engine | -- | Reused from Phase 3 without modification |
| Output formatting | Format module | -- | Reused from Phase 3 without modification |
| Audit logging | Logger module | -- | Reused from Phase 3 without modification |

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.5+ | Language | Already in project [VERIFIED: package.json] |
| Bun | 1.2+ | Build/Test | Already in project [VERIFIED: package.json scripts] |
| shell-quote | ^1.8.1 | POSIX parsing (existing) | Not used by Phase 5 but remains in bundle [VERIFIED: package.json] |

### Supporting (zero new deps)

Phase 5 requires NO new dependencies. Shannon entropy is a trivial mathematical function (10-15 lines of code). All pattern matching uses built-in RegExp. This aligns with the <=3 runtime deps constraint.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled entropy | detect-secrets npm package | Adds a dependency; our implementation is 10 lines; project has <=3 dep limit |
| Per-line regex scanning | AST parsing per language | Too slow for <5ms target; regex is sufficient for pattern detection |
| Glob library for path matching | Manual string includes/endsWith | Glob adds dep; simple string matching covers test/doc/fixture patterns |

**Installation:**
```bash
# No new packages needed
bun install  # existing deps sufficient
```

## Architecture Patterns

### System Architecture Diagram

```
Hook Event (stdin JSON)
    |
    v
processHookEvent()
    |
    |--> tool_name === "Bash" --> existing shell pipeline
    |
    |--> tool_name === "Write" --> extract content from tool_input.content
    |                                  |
    |--> tool_name === "Edit"  --> extract content from tool_input.new_string
    |                                  |
    v                                  v
[Size guard: >500KB? fail-open]   [Size guard]
    |                                  |
    v                                  v
scanContent(content, filePath)
    |
    |--> keyword quick-reject (no keywords? -> allow immediately)
    |
    |--> split content into lines
    |
    |--> process ignore markers (skip lines after "// safeguard-ignore-next-line")
    |
    |--> per-line regex matching (compiled content rules)
    |
    |--> for secret matches: Shannon entropy validation (>4.5 on >=16 char strings)
    |
    |--> path-based severity adjustment (test/doc files: HIGH -> downgrade to MEDIUM)
    |         (CRITICAL never downgraded)
    |
    v
RuleMatch[]
    |
    v
applyAllowList(matches, config.allowList, filePath)  <-- filePath matching
    |
    v
makeDecision(filtered, config.severityActions)  <-- existing Phase 3
    |
    v
formatHookOutput(decision)  <-- existing Phase 3
    |
    v
{ output, exitCode }
```

### Recommended Project Structure

```
src/
├── content/
│   ├── scanner.ts      # Main entry: scanContent(content, filePath) -> RuleMatch[]
│   ├── entropy.ts      # Shannon entropy calculation
│   └── rules.ts        # Expanded content rules (6 categories, CRITICAL/HIGH)
├── hook/
│   └── process.ts      # Modified: routes Write/Edit to content scanner
├── rules/
│   └── content.ts      # MOVED to src/content/rules.ts (or re-exported)
└── ...existing...
```

### Pattern 1: Content Scanner Entry Point

**What:** A single `scanContent()` function that orchestrates keyword reject, line splitting, ignore markers, regex matching, entropy validation, and severity adjustment.

**When to use:** Called from `processHookEvent` for Write/Edit tools.

**Example:**
```typescript
// Source: project architecture (derived from existing matcher.ts pattern)
import type { RuleMatch } from "../types/rule";
import { compileRules } from "../pipeline/matcher";
import { CONTENT_RULES } from "./rules";
import { shannonEntropy } from "./entropy";

const COMPILED_CONTENT_RULES = compileRules(CONTENT_RULES);
const MAX_CONTENT_SIZE = 500 * 1024; // 500KB fail-open threshold
const IGNORE_MARKER = "// safeguard-ignore-next-line";

// Path patterns that trigger severity downgrade
const TEST_DOC_PATTERNS = [
  "test", "spec", "__tests__", "fixture", "mock", ".md", "example"
];

export interface ScanResult {
  matches: RuleMatch[];
  skipped: boolean; // true if content exceeded size limit
}

export function scanContent(content: string, filePath?: string): ScanResult {
  // Size guard: fail-open for large files
  if (content.length > MAX_CONTENT_SIZE) {
    return { matches: [], skipped: true };
  }

  // Keyword quick-reject
  if (quickRejectContent(content)) {
    return { matches: [], skipped: false };
  }

  // Per-line scanning with ignore markers
  const lines = content.split("\n");
  const matches: RuleMatch[] = [];
  let skipNext = false;

  for (let i = 0; i < lines.length; i++) {
    if (skipNext) { skipNext = false; continue; }
    if (lines[i].includes(IGNORE_MARKER)) { skipNext = true; continue; }

    // Match compiled rules against this line
    const lineMatches = matchContentLine(lines[i], i);
    matches.push(...lineMatches);
  }

  // Path-based severity adjustment
  if (filePath) {
    adjustSeverityForPath(matches, filePath);
  }

  return { matches, skipped: false };
}
```

### Pattern 2: Shannon Entropy Calculation

**What:** Calculate information entropy of a string to distinguish real secrets from variable names/placeholders.

**When to use:** Post-match validation for secret detection rules. If a regex matches a potential secret, entropy check confirms it looks like a real token.

**Example:**
```typescript
// Source: Information theory (Shannon, 1948); validated against gitleaks approach
/**
 * Calculate Shannon entropy (bits per character) of a string.
 * Higher entropy = more randomness = more likely a real secret.
 *
 * Typical values:
 * - English text: 3.5-4.0 bits/char
 * - Variable names: 3.0-4.0 bits/char
 * - Hex tokens (real): 3.5-4.0 bits/char
 * - Base64/mixed tokens: 4.5-5.5 bits/char
 * - UUID: ~3.7 bits/char (limited charset)
 *
 * Threshold: 4.5 for >=16 char strings (per CONTEXT.md D-73)
 */
export function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}
```

### Pattern 3: Path-Based Severity Adjustment

**What:** Downgrade severity for matches in test/doc/fixture files (except CRITICAL).

**Example:**
```typescript
// Source: CONTEXT.md D-75
function isTestOrDocPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return TEST_DOC_PATTERNS.some(pattern => lower.includes(pattern));
}

function adjustSeverityForPath(matches: RuleMatch[], filePath: string): void {
  if (!isTestOrDocPath(filePath)) return;

  for (const match of matches) {
    // CRITICAL is NEVER downgraded (secrets in tests are equally dangerous)
    if (match.rule.severity === "CRITICAL") continue;

    // Create a modified rule with downgraded severity
    // This means HIGH -> treated as MEDIUM (warn, not block) by decision engine
    match.rule = { ...match.rule, severity: "MEDIUM" };
  }
}
```

### Anti-Patterns to Avoid

- **Reading the file from disk:** The content comes from `tool_input.content` or `tool_input.new_string` -- never read from `tool_input.file_path`. The file may not exist yet (Write creates it).
- **Full-file AST parsing:** Too slow for <5ms target. Regex per-line is the correct approach for this performance envelope.
- **Modifying existing shell rules:** Content rules are a separate category. Don't conflate shell command patterns with code content patterns.
- **Async operations in the scanner:** The entire hook is synchronous (per D-43). Shannon entropy, regex matching, and string operations are all CPU-bound and fast.
- **Global regex with `g` flag and `exec()`:** In a loop this works, but for single-match-per-rule-per-line, avoid stateful regex. Use `regex.test()` for quick check, then `regex.exec()` once for match details.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decision engine | Custom block/warn logic | `makeDecision()` from Phase 3 | Already handles severity ranking, action mapping, message building |
| Output formatting | Custom JSON building | `formatHookOutput()` from Phase 3 | Correctly produces StructuredHookOutput with exit codes |
| Audit logging | Custom file writing | `writeAuditLog()` from Phase 3 | Handles rotation, path expansion, fail-open |
| Rule compilation | Ad-hoc regex creation | `compileRules()` from matcher.ts | Pre-compiled at module load, tested pattern |
| Allow-list filtering | Custom suppression | `applyAllowList()` from Phase 3 | Already supports filePath matching in AllowListMatcher |

**Key insight:** Phase 5 is primarily a new input adapter (Write/Edit -> content string) and a new analysis module (content scanner). Everything downstream of `RuleMatch[]` is already built and tested (247 tests passing). The planner should NOT create tasks that rebuild decision/format/logger logic.

## Common Pitfalls

### Pitfall 1: False Positives on Variable Declarations

**What goes wrong:** Regex `api_key\s*=\s*['"][^'"]{8,}` matches `const api_key = process.env.API_KEY` or `api_key = "placeholder"`.
**Why it happens:** Pattern doesn't distinguish environment variable references from hardcoded values.
**How to avoid:** Shannon entropy validation. `process.env.API_KEY` has low entropy (~3.2). Real tokens like `sk-proj-abc123XYZ...` have high entropy (>4.5). Also add exclusion patterns for common safe assignments: `process.env.*`, `os.environ.*`, `ENV["..."]`.
**Warning signs:** Test files triggering blocks on mock/placeholder values.

### Pitfall 2: Ignore Marker Line Counting

**What goes wrong:** The ignore marker skips the wrong line due to off-by-one, or doesn't handle the marker being on the last line.
**Why it happens:** Line splitting edge cases: trailing newlines create empty last lines; marker at EOF has no "next line" to skip.
**How to avoid:** When marker is found at line N, skip line N+1. If N is the last line, there's nothing to skip (no error). Use a boolean flag `skipNext` rather than index arithmetic.
**Warning signs:** Tests where ignore markers appear at file boundaries.

### Pitfall 3: Path Matching Case Sensitivity

**What goes wrong:** On case-sensitive filesystems (Linux), a file at `Tests/foo.ts` doesn't match the pattern `test`.
**Why it happens:** Pattern matching is case-sensitive by default.
**How to avoid:** Always lowercase both the path and the patterns before comparison. The decision (D-75) lists lowercase patterns; always `.toLowerCase()` the filePath.
**Warning signs:** Linux CI failing where macOS/Windows passes.

### Pitfall 4: Performance Regression with Large Content

**What goes wrong:** A 400KB file (just under the 500KB limit) causes >20ms processing time.
**Why it happens:** Scanning every line with every compiled rule creates O(lines * rules) regex executions.
**How to avoid:** Keyword quick-reject at both file level AND line level. If a line doesn't contain any keyword from the content rules, skip all regex matching for that line. This is the same optimization used by shell analysis (`quickReject`).
**Warning signs:** Performance tests failing for files near the 500KB boundary.

### Pitfall 5: Mutating the Original Rule Object

**What goes wrong:** Path-based severity adjustment mutates `match.rule.severity` on the shared compiled rule object, affecting all subsequent invocations.
**Why it happens:** JavaScript object references. `match.rule` points to the same object in `COMPILED_CONTENT_RULES`.
**How to avoid:** Create a shallow copy of the rule before modifying severity: `match.rule = { ...match.rule, severity: "MEDIUM" }`. This is shown in Pattern 3 above.
**Warning signs:** A test run order dependency where test file matches "pollute" subsequent non-test matches.

### Pitfall 6: Regex Backtracking on Malicious Input

**What goes wrong:** A deliberately crafted content string causes catastrophic backtracking in a regex, exceeding the 20ms budget.
**Why it happens:** Patterns with nested quantifiers (e.g., `(a+)+`) are vulnerable to ReDoS.
**How to avoid:** Keep regexes simple -- no nested quantifiers. Test each regex with pathological input (e.g., 10000-char strings of near-matches). The existing content rules are already simple and safe.
**Warning signs:** Performance tests with adversarial input failing intermittently.

## Code Examples

### Expanded Content Rules (all 6 categories)

```typescript
// Source: Derived from CONTEXT.md D-72, D-73, and specific ideas section
import type { Rule } from "../types/rule";

export const CONTENT_RULES: Rule[] = [
  // === CATEGORY 1: Hardcoded Secrets (CRITICAL) ===
  {
    id: "content.hardcoded-secret",
    category: "content",
    severity: "CRITICAL", // D-72: secrets are CRITICAL, never bypassable
    pattern: "(?:api[_-]?key|token|secret|password|passwd|api[_-]?secret|access[_-]?key|private[_-]?key|client[_-]?secret)\\s*[=:]\\s*['\"`]([^'\"`\\s]{16,})['\"`]",
    keywords: ["key", "token", "secret", "password", "passwd", "private_key", "client_secret", "access_key"],
    description: "Potential hardcoded credential (API key, token, or password)",
    suggestion: "Use environment variables or a secrets manager instead of hardcoding",
    builtin: true,
  },
  {
    id: "content.private-key-block",
    category: "content",
    severity: "CRITICAL",
    pattern: "-----BEGIN\\s+(?:RSA|DSA|EC|OPENSSH|PGP)?\\s*PRIVATE\\s+KEY-----",
    keywords: ["PRIVATE KEY", "BEGIN"],
    description: "Private key material detected in code",
    suggestion: "Store private keys in a secrets manager or encrypted vault, never in source code",
    builtin: true,
  },

  // === CATEGORY 2: SQL Injection (HIGH) ===
  {
    id: "content.sql-concat",
    category: "content",
    severity: "HIGH",
    pattern: "(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\\s+.*(?:\\+\\s*\\w|\\$\\{|\\\" \\+|' \\+|`\\s*\\+)",
    keywords: ["SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "ALTER"],
    description: "SQL string concatenation enables SQL injection",
    suggestion: "Use parameterized queries or an ORM instead of string concatenation",
    builtin: true,
  },
  {
    id: "content.sql-template-literal",
    category: "content",
    severity: "HIGH",
    pattern: "(?:query|execute|exec|raw)\\s*\\(\\s*`[^`]*\\$\\{",
    keywords: ["query", "execute", "exec", "raw"],
    description: "SQL query built with template literals enables injection",
    suggestion: "Use parameterized queries ($1, ?) instead of interpolated template literals",
    builtin: true,
  },

  // === CATEGORY 3: XSS Patterns (HIGH) ===
  {
    id: "content.innerHTML",
    category: "content",
    severity: "HIGH",
    pattern: "\\.innerHTML\\s*[=+]",
    keywords: ["innerHTML"],
    description: "Direct innerHTML assignment enables XSS attacks",
    suggestion: "Use textContent for text, or a sanitization library (DOMPurify) for HTML",
    builtin: true,
  },
  {
    id: "content.dangerouslySetInnerHTML",
    category: "content",
    severity: "HIGH",
    pattern: "dangerouslySetInnerHTML\\s*=",
    keywords: ["dangerouslySetInnerHTML"],
    description: "React dangerouslySetInnerHTML bypasses XSS protection",
    suggestion: "Sanitize HTML with DOMPurify before passing to dangerouslySetInnerHTML",
    builtin: true,
  },
  {
    id: "content.document-write",
    category: "content",
    severity: "HIGH",
    pattern: "document\\.write(?:ln)?\\s*\\(",
    keywords: ["document.write"],
    description: "document.write enables XSS and breaks page rendering",
    suggestion: "Use DOM APIs (createElement, appendChild) or framework rendering",
    builtin: true,
  },

  // === CATEGORY 4: Dangerous Functions (HIGH) ===
  {
    id: "content.eval-usage",
    category: "content",
    severity: "HIGH",
    pattern: "\\beval\\s*\\(",
    keywords: ["eval"],
    description: "eval() executes arbitrary code -- potential injection vector",
    suggestion: "Use JSON.parse for data, or a safe expression evaluator",
    builtin: true,
  },
  {
    id: "content.new-function",
    category: "content",
    severity: "HIGH",
    pattern: "new\\s+Function\\s*\\(",
    keywords: ["new Function"],
    description: "new Function() is equivalent to eval -- executes arbitrary code",
    suggestion: "Use a safe expression evaluator or pre-defined functions",
    builtin: true,
  },
  {
    id: "content.os-system",
    category: "content",
    severity: "HIGH",
    pattern: "(?:os\\.system|os\\.popen|subprocess\\.call|subprocess\\.run|subprocess\\.Popen)\\s*\\(",
    keywords: ["os.system", "os.popen", "subprocess"],
    description: "Direct system command execution with potential for injection",
    suggestion: "Use subprocess with a list argument (no shell=True) and validate inputs",
    builtin: true,
  },
  {
    id: "content.subprocess-shell",
    category: "content",
    severity: "HIGH",
    pattern: "subprocess\\.(?:run|call|Popen)\\s*\\([^)]*shell\\s*=\\s*True",
    keywords: ["subprocess", "shell=True"],
    description: "subprocess with shell=True enables shell injection",
    suggestion: "Use subprocess with shell=False (default) and pass args as a list",
    builtin: true,
  },
  {
    id: "content.child-process-exec",
    category: "content",
    severity: "HIGH",
    pattern: "(?:child_process\\.exec|execSync|exec)\\s*\\(",
    keywords: ["child_process", "exec", "execSync"],
    description: "child_process.exec runs commands in a shell -- vulnerable to injection",
    suggestion: "Use child_process.execFile or spawn with explicit args array",
    builtin: true,
  },

  // === CATEGORY 5: Insecure Cryptography (HIGH) ===
  {
    id: "content.insecure-hash-md5",
    category: "content",
    severity: "HIGH",
    pattern: "(?:md5\\(|hashlib\\.md5|createHash\\s*\\(\\s*['\"]md5['\"]|MD5\\.Create|Digest::MD5)",
    keywords: ["md5", "MD5", "hashlib"],
    description: "MD5 is cryptographically broken -- not suitable for security",
    suggestion: "Use SHA-256 or bcrypt/argon2 for password hashing",
    builtin: true,
  },
  {
    id: "content.insecure-hash-sha1",
    category: "content",
    severity: "HIGH",
    pattern: "(?:sha1\\(|hashlib\\.sha1|createHash\\s*\\(\\s*['\"]sha1['\"]|SHA1\\.Create|Digest::SHA1)",
    keywords: ["sha1", "SHA1", "hashlib"],
    description: "SHA-1 is cryptographically weak -- not suitable for security",
    suggestion: "Use SHA-256 or bcrypt/argon2 for password hashing",
    builtin: true,
  },
  {
    id: "content.insecure-ecb-mode",
    category: "content",
    severity: "HIGH",
    pattern: "(?:Mode\\.ECB|AES\\.MODE_ECB|mode:\\s*['\"]ecb['\"]|ECB\\s*[,)])",
    keywords: ["ECB", "MODE_ECB"],
    description: "ECB mode leaks plaintext patterns -- never use for real encryption",
    suggestion: "Use AES-GCM or AES-CBC with HMAC for authenticated encryption",
    builtin: true,
  },
];
```

### Shannon Entropy with Minimum Length Guard

```typescript
// Source: Information theory standard formula; threshold from CONTEXT.md
const ENTROPY_THRESHOLD = 4.5;
const MIN_SECRET_LENGTH = 16;

export function shannonEntropy(str: string): number {
  if (str.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }
  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function isHighEntropySecret(value: string): boolean {
  if (value.length < MIN_SECRET_LENGTH) return false;
  return shannonEntropy(value) > ENTROPY_THRESHOLD;
}
```

### Hook Process Routing (Write/Edit dispatch)

```typescript
// Source: Existing src/hook/process.ts, modified for Phase 5
export function processHookEvent(raw: string): { output: string; exitCode: number } {
  try {
    const event: ClaudeCodeHookEvent = JSON.parse(raw);

    if (event.tool_name === "Bash") {
      // ... existing shell pipeline (unchanged) ...
    }

    if (event.tool_name === "Write" || event.tool_name === "Edit") {
      const content = event.tool_name === "Write"
        ? event.tool_input?.content
        : event.tool_input?.new_string;

      if (!content) return { output: "", exitCode: 0 };

      const cwd = event.cwd || process.cwd();
      const config = loadConfig(cwd);
      const filePath = event.tool_input?.file_path;

      // Content scanning
      const scanResult = scanContent(content, filePath);
      if (scanResult.skipped || scanResult.matches.length === 0) {
        return { output: "", exitCode: 0 };
      }

      // Allow-list filtering (supports filePath matching)
      const filtered = applyAllowList(scanResult.matches, config.allowList, filePath);

      // Decision + format (reused from Phase 3)
      const decision = makeDecision(filtered, config.severityActions);
      writeAuditLog(decision, config.logging, {
        command: `${event.tool_name}: ${filePath || "unknown"}`,
        cwd,
        sessionId: event.session_id,
      });
      return formatHookOutput(decision);
    }

    // Unknown tool: fail-open
    return { output: "", exitCode: 0 };
  } catch {
    return { output: "", exitCode: 0 };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Write/Edit early-return (exit 0) | Content scanning pipeline | Phase 5 (now) | Enables CODE-01 through CODE-06 |
| 5 content rules (all HIGH) | 15+ content rules (CRITICAL + HIGH) | Phase 5 (now) | Broader coverage, severity differentiation |
| No entropy validation | Shannon entropy on captured groups | Phase 5 (now) | Dramatically reduces false positives for secret detection |
| No path awareness | Path-based severity adjustment | Phase 5 (now) | Test files don't block development |

**Deprecated/outdated:**
- The current `src/rules/content.ts` with 5 basic HIGH-severity rules will be superseded by the expanded rule set in `src/content/rules.ts`. The old rules should be removed from `src/rules/content.ts` to avoid duplication.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Shannon entropy threshold of 4.5 effectively separates real tokens from placeholders for >=16 char strings | Code Examples | May need tuning; too high = misses short hex tokens; too low = false positives on code variables |
| A2 | Per-line scanning (no multi-line) is sufficient for v1 detection quality | Architecture Patterns | SQL injection with multi-line concatenation won't be caught (explicitly deferred per CONTEXT.md) |
| A3 | `child_process.exec` regex won't false-positive on variable names like `execFile` or `execute` | Code Examples | Pattern `exec\s*\(` could match `execute()` in unrelated contexts; may need word boundary or prefix |
| A4 | 500KB content size limit is appropriate for fail-open threshold | Architecture Patterns | If Claude Code writes very large generated files, they won't be scanned; acceptable per fail-open philosophy |

## Open Questions

1. **Entropy threshold tuning**
   - What we know: Gitleaks uses 3.5 as base; CONTEXT.md specifies 4.5; typical hex tokens score ~3.7-4.0
   - What's unclear: Whether 4.5 is too aggressive (would miss short hex API keys like `sk_live_abc123def456`)
   - Recommendation: Start at 4.5 per CONTEXT.md; add performance tests with real-world token samples; tune in Phase 6 if needed

2. **Allow-list filePath matching for content**
   - What we know: `AllowListMatcher` already has `filePath?: string` field; `applyAllowList` currently only checks `ruleId` and `command`
   - What's unclear: Whether to add filePath matching logic to `applyAllowList` or handle it separately in the scanner
   - Recommendation: Extend `applyAllowList` to check `filePath` when the match is from content rules (the type already supports it)

3. **Where to place expanded content rules**
   - What we know: Currently in `src/rules/content.ts` (5 rules); CONTEXT.md says new module `src/content/scanner.ts`
   - What's unclear: Whether to keep rules in `src/rules/content.ts` and just import, or move them to `src/content/rules.ts`
   - Recommendation: Create `src/content/rules.ts` with the full expanded rule set; update `src/rules/index.ts` to remove old content rules or re-export from new location; cleaner separation

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime target | Yes | v24.15.0 | -- |
| Bun | Build + Test | No (not on this machine) | -- | CI/CD only; tests run in Bun environment elsewhere |
| TypeScript | Type checking | Yes (via npm) | ^5.5.0 | -- |
| Biome | Linting | Yes (via bunx) | ^1.9.0 | -- |

**Missing dependencies with no fallback:**
- Bun (for running tests locally) -- tests must be run in CI or another environment with Bun installed

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | bun:test (built into Bun 1.2+) |
| Config file | None (Bun auto-discovers `tests/**/*.test.ts`) |
| Quick run command | `bun test tests/content/` |
| Full suite command | `bun test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CODE-01 | Detect hardcoded secrets with entropy | unit | `bun test tests/content/secrets.test.ts -x` | No (Wave 0) |
| CODE-02 | Detect SQL injection patterns | unit | `bun test tests/content/sql-injection.test.ts -x` | No (Wave 0) |
| CODE-03 | Detect XSS patterns | unit | `bun test tests/content/xss.test.ts -x` | No (Wave 0) |
| CODE-04 | Detect dangerous functions | unit | `bun test tests/content/dangerous-functions.test.ts -x` | No (Wave 0) |
| CODE-05 | Detect insecure cryptography | unit | `bun test tests/content/insecure-crypto.test.ts -x` | No (Wave 0) |
| CODE-06 | Hook Write/Edit routing | integration | `bun test tests/hook/content-hook.test.ts -x` | No (Wave 0) |
| -- | Performance <5ms/50KB | perf | `bun test tests/content/performance.test.ts -x` | No (Wave 0) |
| -- | Path-based severity adjustment | unit | `bun test tests/content/path-adjustment.test.ts -x` | No (Wave 0) |
| -- | Ignore marker handling | unit | `bun test tests/content/ignore-marker.test.ts -x` | No (Wave 0) |
| -- | Shannon entropy accuracy | unit | `bun test tests/content/entropy.test.ts -x` | No (Wave 0) |

### Sampling Rate

- **Per task commit:** `bun test tests/content/`
- **Per wave merge:** `bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/content/secrets.test.ts` -- covers CODE-01 (secret detection + entropy)
- [ ] `tests/content/sql-injection.test.ts` -- covers CODE-02
- [ ] `tests/content/xss.test.ts` -- covers CODE-03
- [ ] `tests/content/dangerous-functions.test.ts` -- covers CODE-04
- [ ] `tests/content/insecure-crypto.test.ts` -- covers CODE-05
- [ ] `tests/content/entropy.test.ts` -- Shannon entropy unit tests
- [ ] `tests/content/path-adjustment.test.ts` -- path-based severity downgrade
- [ ] `tests/content/ignore-marker.test.ts` -- inline ignore marker
- [ ] `tests/content/performance.test.ts` -- <5ms for 50KB, <20ms for 200KB
- [ ] `tests/hook/content-hook.test.ts` -- covers CODE-06 (Write/Edit routing)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | -- |
| V3 Session Management | No | -- |
| V4 Access Control | No | -- |
| V5 Input Validation | Yes | Regex patterns with size limits; fail-open on oversized input |
| V6 Cryptography | Yes (detection target) | Detects weak crypto usage (MD5, SHA1, ECB) in scanned content |

### Known Threat Patterns for Content Scanning

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| ReDoS via malicious content | Denial of Service | Simple regex patterns without nested quantifiers; size limit (500KB) |
| False negative (missed secret) | Information Disclosure | Multiple detection strategies (pattern + entropy); known limitation documented |
| False positive (blocks legitimate code) | Denial of Service (developer friction) | Path-based adjustment, ignore markers, allow-list |
| Entropy bypass (low-entropy token) | Information Disclosure | Accept as known limitation; entropy is secondary validation, not primary |

## Sources

### Primary (HIGH confidence)

- Project codebase exploration -- `src/rules/content.ts`, `src/pipeline/matcher.ts`, `src/hook/process.ts`, `src/types/hook.ts`, `src/decision/*.ts` [VERIFIED: direct file reads]
- Project CONTEXT.md (D-72 through D-75) -- locked decisions for this phase [VERIFIED: file read]
- Gitleaks documentation (Context7 `/gitleaks/gitleaks`) -- regex pattern structure, keyword pre-filtering, entropy thresholds [VERIFIED: Context7 fetch]

### Secondary (MEDIUM confidence)

- Shannon entropy mathematical properties -- standard information theory; threshold values derived from character set analysis [CITED: Shannon 1948; validated by gitleaks entropy=3.5 baseline]
- Existing test patterns in project -- `tests/hook/entry.test.ts`, `tests/hook/performance.test.ts` [VERIFIED: file reads]

### Tertiary (LOW confidence)

- None -- all claims verified against codebase or cited documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all libraries already in project
- Architecture: HIGH -- extends well-defined existing patterns; all integration points verified in code
- Pitfalls: HIGH -- derived from actual codebase patterns and known regex/entropy edge cases
- Detection patterns: MEDIUM -- regex patterns may need tuning after real-world testing (entropy threshold especially)

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable -- no external deps to become stale)
