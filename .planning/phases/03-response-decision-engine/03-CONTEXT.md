# Phase 3: Response & Decision Engine - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform RuleMatch[] from the analysis pipeline into final graduated responses: severity-to-action mapping, HookOutput construction with structured reason messages, JSONL audit logging, and allow-list suppression. Delivers the decision engine that connects detection (Phase 2) to hook output (Phase 4).

Requirements covered: RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, RESP-07

</domain>

<decisions>
## Implementation Decisions

### Message Formatting (RESP-06)
- **D-47:** The `reason` field in HookOutput is consumed by Claude AI (not directly by the human user). Claude Code passes it to the AI model as "tool call denied" context. Claude then explains to the user in natural language and asks whether to proceed.
- **D-48:** Message content is plain text (no markdown, no ANSI colors). Contains: what was detected (matched command text), why it's dangerous (rule description), and a safe alternative (rule suggestion field).
- **D-49:** No special formatting needed — keep it concise and informative for an AI to relay. Example: `"Blocked: rm -rf / — Recursive deletion targeting root directory. Suggest: Use rm with specific file paths instead."`

### Multi-Rule Conflict Resolution
- **D-50:** When multiple rules match the same command, the highest severity determines the final action (CRITICAL > HIGH > MEDIUM > LOW > INFO).
- **D-51:** The reason field lists ALL matched rules (not just the highest), so Claude AI can give the user a complete picture. Format: primary rule description first, then "Also triggered: [other rule IDs]".
- **D-52:** The Decision object stores all RuleMatch[] (already in the interface), and HookOutput.matchedPatterns lists all matched rule IDs.

### Audit Logging (RESP-07)
- **D-53:** Default log path: `~/.config/yolo-safeguard/audit.jsonl`. Configurable via `Config.logging.path` (user can set to project-level path).
- **D-54:** Tiered logging — block/warn records include full detail (timestamp, action, severity, command, cwd, session_id, matched rules with descriptions, suggestion). Allow records are minimal (timestamp, action, command only). This keeps log volume manageable.
- **D-55:** Log writes are synchronous (appendFileSync) to guarantee durability without async overhead. If write fails, fail silently (never block a command because logging broke — fail-open principle).
- **D-56:** Log rotation: when file exceeds `Config.logging.maxSizeMb`, rename to `.1` backup and start fresh. Single backup only (not multi-file rotation — keep it simple).

### Graduated Response (RESP-02 through RESP-05)
- **D-57:** CRITICAL → exit code 2 (hard block, Claude Code protocol). No session bypass possible — this is enforced by the hook protocol itself.
- **D-58:** HIGH → exit code 2 (block). Same protocol as CRITICAL, but semantically less severe. User can be asked to approve via Claude's natural follow-up.
- **D-59:** MEDIUM → exit code 0 (allow), but emit a warning. The "warn" action allows execution but includes advisory info in stdout JSON that Claude can mention to the user.
- **D-60:** LOW → exit code 0 (allow). Logged only. No stdout message, no user-visible signal.
- **D-61:** Allow-list entries suppress matches before the decision is made — if a command matches an AllowListEntry, those rule matches are removed from consideration.

### Hook Output Protocol
- **D-62:** Exit code 0 = allow (proceed with tool use). Stdout JSON is optional (for warn/advisory).
- **D-63:** Exit code 2 = block (deny tool use). Stdout JSON with `reason` is REQUIRED by Claude Code protocol.
- **D-64:** For "warn" action: exit code 0 + stdout JSON with `{ "decision": "allow", "reason": "⚠ [warning message]" }`. Claude sees the advisory and may choose to mention it.

### Claude's Discretion
- Internal function naming within src/decision/ or src/response/
- JSONL field ordering
- Whether to batch multiple allow-log writes (micro-optimization)
- Test fixture structure for multi-rule scenarios
- Module file splitting (single file vs separate decide.ts + format.ts + logger.ts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — RESP-02 through RESP-07 requirements
- `.planning/ROADMAP.md` — Phase 3 success criteria

### Phase 1 Artifacts (types this phase implements)
- `src/types/decision.ts` — Decision interface (action, severity, matchedRules, message, suggestion)
- `src/types/hook.ts` — HookOutput interface (decision, reason, rule, severity, suggestion, matchedPatterns)
- `src/types/severity.ts` — Severity type, Action type, DEFAULT_SEVERITY_ACTIONS map
- `src/types/config.ts` — Config interface (severityActions, customRules, allowList, logging)

### Phase 2 Artifacts (input to this phase)
- `src/pipeline/index.ts` — analyzeCommand() returns AnalysisResult { matches: RuleMatch[], segmentCount, maxDepth }
- `src/pipeline/types.ts` — AnalysisResult interface
- `.planning/phases/02-shell-command-analysis/02-CONTEXT.md` — Pipeline decisions D-25 through D-46

### Config System
- `src/config/loader.ts` — loadConfig() merges defaults → user → project config
- `src/config/defaults.ts` — DEFAULT_CONFIG with DEFAULT_SEVERITY_ACTIONS

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/severity.ts` — DEFAULT_SEVERITY_ACTIONS already maps severity→action
- `src/types/decision.ts` — Decision interface ready to implement
- `src/types/hook.ts` — HookOutput interface ready to implement
- `src/types/config.ts` — Config.logging (path, maxSizeMb, enabled), Config.allowList
- `src/config/loader.ts` — loadConfig() provides merged config for allow-list and severity mapping
- `src/pipeline/index.ts` — analyzeCommand() is the input function

### Established Patterns
- Synchronous execution (no async in hot path)
- Barrel exports via index.ts per directory
- Fail-open on errors (never block due to internal failures)
- Types defined in src/types/, implementation in feature directories

### Integration Points
- Input: AnalysisResult from analyzeCommand() (RuleMatch[])
- Input: Config from loadConfig() (severity mapping, allow-list, logging config)
- Output: HookOutput (exit code + JSON) for Phase 4's hook entry point
- Output: JSONL append to audit log file

</code_context>

<specifics>
## Specific Ideas

- Decision engine is a pure function: (AnalysisResult, Config) → Decision → HookOutput
- Allow-list matching runs BEFORE severity classification (suppressed matches never reach the decision)
- The severity-to-action lookup uses Config.severityActions (user-customizable) not hardcoded DEFAULT
- For "warn" action, the hook still exits 0 (allow) but includes advisory JSON — Claude may or may not relay it
- Audit log write happens AFTER decision is made but BEFORE hook exits (guarantees record even on block)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 3-Response & Decision Engine*
*Context gathered: 2026-05-21*
