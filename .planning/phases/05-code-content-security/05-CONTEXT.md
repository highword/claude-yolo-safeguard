# Phase 5 Context: Code Content Security

**Phase goal:** Detect dangerous code patterns (hardcoded secrets, XSS, SQL injection, eval, insecure crypto) written via Write/Edit tools and block them before execution.

**Context gathered:** 2026-06-01
**Status:** LOCKED — ready for planning

---

<domain>
## Phase Boundary

Phase 5 extends the hook to intercept Write and Edit tool invocations (not just Bash). It routes their content through a new content scanner that detects 6 categories of dangerous code patterns. The existing decision engine and output formatting from Phase 3/4 are reused.

**In scope:** Content scanning for Write/Edit tools, routing in hook entry point, 6 detection categories (secrets, XSS, SQLi, eval, crypto, dangerous functions), path-based severity adjustment, inline ignore markers.

**Out of scope:** Shell command analysis improvements (Phase 2 done), PowerShell-specific patterns (Phase 6), custom user rules (Phase 6), multi-line pattern matching (v2 backlog).
</domain>

<decisions>
## Implementation Decisions

### Detection Severity (D-72)
- Hardcoded secrets/tokens → **CRITICAL** (never bypassable, session cannot override)
- All other content detections (XSS, SQLi, eval, dangerous functions, insecure crypto) → **HIGH** (block with explanation + safe alternative)
- Rationale: Secrets leaked to git are irrecoverable (bots scan in seconds). Code quality issues are fixable in-place.

### Content Analysis Architecture (D-73)
- New module: `src/content/scanner.ts` — lightweight wrapper over the existing matcher regex engine
- Approach: keyword quick-reject + per-line regex scanning
- Reuses `matchRules()` pattern matching from `src/pipeline/matcher.ts`
- Adds Shannon entropy calculation for enhanced secret detection (distinguishing real tokens from variable names)
- Performance: <5ms for typical files (50KB), <20ms for large files (200KB)
- Multi-line pattern matching deferred to v2 backlog

### Write vs Edit Behavior (D-74)
- **Write tool:** Analyze `tool_input.content` (the full file being written)
- **Edit tool:** Analyze only `tool_input.new_string` (the replacement text being introduced)
- Semantic: "Detect risk introduced by THIS operation" — not "audit the entire file state"
- Safety valve: Content >500KB skips scanning (fail-open) to avoid latency spikes
- Rationale: Prevents false positives from pre-existing code; keeps detection relevant to current action

### False Positive Reduction (D-75)
- **Path-based severity adjustment:** Files matching test/doc/fixture patterns (`*test*`, `*spec*`, `*__tests__*`, `*fixture*`, `*mock*`, `*.md`, `*example*`) → severity downgraded to warn (not block)
- **Exception:** CRITICAL detections (hardcoded secrets) are NEVER downgraded — secrets in test files are equally dangerous (they get committed to git)
- **Inline ignore marker:** Content containing `// safeguard-ignore-next-line` causes the scanner to skip the immediately following line
- **No file I/O required:** Path comes from `tool_input.file_path` in the hook event; no disk read needed

### Claude's Discretion
- Internal module structure within `src/content/` (how many files, naming)
- Entropy threshold value for secret detection
- Exact regex patterns for CODE-05 (insecure crypto detection)
- Whether to export scanner functions individually or as a single `scanContent()` entry point
- Test organization (one test file per category vs unified)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Code (reuse patterns)
- `src/rules/content.ts` — Already-defined content rule patterns (5 rules: secrets, eval, innerHTML, SQL concat, dangerouslySetInnerHTML)
- `src/pipeline/matcher.ts` — Regex matching engine to reuse (matchRules function)
- `src/hook/process.ts` — Hook routing logic (currently returns exit 0 for non-Bash; Phase 5 changes this)
- `src/decision/allow-list.ts` — Allow-list pattern matching (reference for path-based filtering)
- `src/types/hook.ts` — ClaudeCodeHookEvent type (tool_input structure for Write/Edit)
- `src/types/rule.ts` — Rule interface (pattern, keywords, severity, category)

### Project Constraints
- `CLAUDE.md` — Performance <50ms, single-file bundle, fail-open, ≤3 deps
</canonical_refs>

<specifics>
## Specific Ideas

- Entropy calculation: Shannon entropy > 4.5 bits/char on a string ≥16 chars strongly suggests a real token/key (not a variable name or placeholder)
- Path matching should use the same glob-style matching as the existing allow-list system
- The `// safeguard-ignore-next-line` marker should be matched literally (no regex, case-sensitive)
- CODE-05 patterns: `md5(`, `sha1(`, `hashlib.md5`, `createHash('md5')`, `createHash('sha1')`, `Mode.ECB`, `AES.new(..., AES.MODE_ECB`
</specifics>

<deferred>
## Deferred Ideas

- Multi-line SQL concatenation detection (跨行 SQL 拼接匹配) — v2 backlog
- Base64-encoded secret detection — v2 (ADV-02)
- Context-aware detection (understanding if code is reachable vs dead) — out of scope
- Per-language grammar-aware parsing — too complex for regex approach
</deferred>

---

*Phase: 05-code-content-security*
*Context gathered: 2026-06-01 via discuss-phase*
