# Phase 2: Shell Command Analysis - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse, segment, and match shell commands from Claude Code's Bash tool_input.command against safety rules. Delivers: POSIX command parser (via shell-quote), command segmentation, recursive nested command extraction, regex rule matching with token-position false-positive reduction, and Filter application. Output: RuleMatch[] for each dangerous command detected.

Requirements covered: SHELL-01 through SHELL-09, PLAT-01, PLAT-02

</domain>

<decisions>
## Implementation Decisions

### Nested Command Detection (SHELL-05, SHELL-06)
- **D-25:** Recursive unwrapping up to 10 layers deep (per SHELL-05 literal requirement)
- **D-26:** Shell wrappers detected: bash -c, sh -c, zsh -c, dash -c — extract inner string and re-enter full analysis pipeline
- **D-27:** Interpreter one-liners (python -c, node -e, ruby -e, perl -e) — extract string argument and run regex rules on its content (pattern matching, not language-level parsing)
- **D-28:** Recursion uses a stack (not actual recursion) with depth counter; bail at depth 10 with ALLOW (fail-open)

### Compound Command Segmentation (SHELL-07)
- **D-29:** Use shell-quote library to parse POSIX command strings into typed token arrays
- **D-30:** Split segments at operator tokens: && || ; | — each operator is a segment boundary
- **D-31:** All segments treated equally — no distinction between pipe left/right, conditional branches. Every segment enters the full rule matching pipeline independently (safest: prefer false-positives over missed detections)
- **D-32:** Subshell expressions ($(...) and backticks) treated as nested commands — extracted and analyzed recursively (counts toward the 10-layer depth limit)

### False-Positive Reduction (SHELL-08, SHELL-09)
- **D-33:** Token position filtering (semantic level) — shell-quote parse provides token type information; rule matching only triggers on tokens in "command position" (not pure string arguments)
- **D-34:** Quoted string arguments (e.g., echo "rm -rf /", gh issue --body "git reset") are NOT analyzed as commands — shell-quote marks them as string tokens, not operators
- **D-35:** Safe variant distinction: rules use regex negative lookahead/lookbehind patterns + Filter system to exclude safe variants (git push --force-with-lease, rm file.tmp, git branch -d)
- **D-36:** The existing Filter types (notContains, contains) from Phase 1 serve as post-match guards — if a filter condition fails, the match is discarded

### Matching Engine Design
- **D-37:** Pipeline: shell-quote parse → operator split → per-segment: rebuild string → regex match → token position verify → apply Filters → emit RuleMatch[]
- **D-38:** Regex patterns (Phase 1's 19 rules) run against the reconstructed segment string — compatible with existing rule definitions, no rule rewrite needed
- **D-39:** After regex hits, verify that the matched text corresponds to command-position tokens (not arguments/strings) using shell-quote's parse output as ground truth
- **D-40:** Multiple rules can match a single segment — all matches collected and returned (highest severity wins for the decision, but all matches are reported for audit)

### Performance Constraints
- **D-41:** Entire analysis pipeline must complete in <50ms for typical commands (Quick Reject already eliminates most inputs in <1ms)
- **D-42:** shell-quote parse is synchronous and completes in <5ms for typical commands
- **D-43:** No compilation of regex at analysis time — patterns pre-compiled at module load (one-time cost at hook startup, not per-invocation)

### Platform Support (PLAT-01, PLAT-02)
- **D-44:** Phase 2 targets POSIX only (macOS + Linux) — shell-quote handles POSIX grammar correctly
- **D-45:** PowerShell/cmd support deferred to Phase 6 (per ROADMAP)
- **D-46:** Platform detection: if hook determines the command is PowerShell syntax, skip shell-quote parsing and apply regex-only matching as a fallback (best-effort until Phase 6)

### Claude's Discretion
- Internal function naming and module organization within src/pipeline/
- Specific regex optimizations (compilation caching strategy)
- Test fixture design for nested command scenarios
- Whether to expose intermediate parse results for debugging/audit

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — SHELL-01 through SHELL-09, PLAT-01, PLAT-02 requirements
- `.planning/ROADMAP.md` — Phase 2 success criteria

### Phase 1 Artifacts (foundation this phase builds on)
- `.planning/phases/01-foundation-core-types/01-CONTEXT.md` — Rule structure decisions (D-01 through D-24)
- `src/types/rule.ts` — Rule interface, RuleMatch, Filter types
- `src/types/hook.ts` — HookInput, ClaudeCodeHookEvent (input contract)
- `src/rules/index.ts` — ALL_RULES, QUICK_REJECT_SET, quickReject() (fast-path)
- `src/rules/*.ts` — 19 built-in rule definitions with regex patterns

### Library Documentation
- shell-quote npm docs (parse function: string → token array with operators)

### Competitor References (for matching engine patterns)
- shellfirm — regex on raw string + filter-based exclusions
- destructive_command_guard — keyword fast-path + regex matching + pack system

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/rules/index.ts` — ALL_RULES array (19 rules), QUICK_REJECT_SET, quickReject() function
- `src/types/rule.ts` — Rule interface with pattern (regex string), filters (RuleFilter[]), keywords
- `src/config/loader.ts` — loadConfig() for merged config (custom rules + allow-list)
- `src/pipeline/index.ts` — QuickRejectSet interface placeholder (ready to expand)

### Established Patterns
- Rule data is declarative (no logic in rule files) — matching logic lives in pipeline
- Barrel exports via index.ts per directory
- Synchronous execution (no async in hot path)
- Tests colocated in tests/ directory

### Integration Points
- Input: ClaudeCodeHookEvent from stdin (hook_type: "PreToolUse", tool_name: "Bash", tool_input.command)
- Output: RuleMatch[] fed to Phase 3's Decision Engine
- Quick Reject: called before entering the analysis pipeline (already implemented)
- Config: loadConfig().customRules appended to ALL_RULES for matching

</code_context>

<specifics>
## Specific Ideas

- shell-quote's parse output distinguishes string tokens from operator tokens ({op: '&&'}) — use op field to detect segment boundaries
- For nested command extraction: detect patterns like ["bash", "-c", <string>] in token array, extract the string token, re-enter pipeline
- Pre-compile all regex patterns into RegExp objects at module initialization (stored alongside Rule data) — avoids per-invocation compilation cost
- Token position verification: after regex matches on segment string, map match index back to token array positions to confirm command vs argument context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 2-Shell Command Analysis*
*Context gathered: 2026-05-20*
