# Phase 3: Response & Decision Engine - Research

**Researched:** 2026-05-21
**Focus:** Decision engine implementation, audit logging, hook output protocol

## 1. Existing Codebase Analysis

### Types Already Defined (Phase 1)

All core types for Phase 3 are already defined and stable:

```typescript
// src/types/severity.ts
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
type Action = "block" | "warn" | "log" | "off";
type SeverityActionMap = Record<Severity, Action>;
const DEFAULT_SEVERITY_ACTIONS: SeverityActionMap = {
  CRITICAL: "block", HIGH: "block", MEDIUM: "warn", LOW: "log", INFO: "off"
};

// src/types/decision.ts
interface Decision {
  action: Action;
  severity?: Severity;
  matchedRules: RuleMatch[];
  message?: string;
  suggestion?: string;
  timestamp: string;
}

// src/types/hook.ts
interface HookOutput {
  decision: "allow" | "block";
  reason?: string;
  rule?: string;
  severity?: Severity;
  category?: RuleCategory;
  suggestion?: string;
  matchedPatterns?: string[];
}

// src/types/config.ts
interface Config {
  severityActions: SeverityActionMap;
  customRules: Rule[];
  allowList: AllowListEntry[];
  logging: LoggingConfig;
}
interface LoggingConfig { enabled: boolean; path: string; maxSizeMb: number; }
interface AllowListEntry { id: string; match: AllowListMatcher; reason: string; expires?: string; }
interface AllowListMatcher { command?: string; filePath?: string; ruleId?: string; }
```

### Input Contract (Phase 2)

```typescript
// src/pipeline/index.ts
function analyzeCommand(command: string, customRules?: Rule[]): AnalysisResult;
interface AnalysisResult { matches: RuleMatch[]; segmentCount: number; maxDepth: number; }
interface RuleMatch { rule: Rule; matchedText: string; index: number; }
```

### Config System (Phase 1)

- `loadConfig(cwd)` → merged Config with severity mapping, allow-list, logging config
- Default log path: `~/.local/share/yolo-safeguard/audit.jsonl` (in defaults.ts)
- Note: CONTEXT.md says `~/.config/yolo-safeguard/audit.jsonl` but defaults.ts uses `~/.local/share/`. The CONTEXT.md decision (D-53) should prevail — update defaults.ts.

## 2. Hook Protocol Research

### Claude Code PreToolUse Hook Protocol

From project exploration and CLAUDE.md:

| Exit Code | Meaning | Stdout |
|-----------|---------|--------|
| 0 | ALLOW — tool use proceeds | Optional JSON (advisory/warn) |
| 2 | BLOCK — tool use denied | Required JSON with `reason` |

Key constraint: The hook is a child process that receives JSON on stdin (ClaudeCodeHookEvent) and must respond synchronously via exit code + stdout. No async, no network calls.

### Warn Implementation Strategy

For MEDIUM severity ("warn" action):
- Exit code MUST be 0 (allow execution)
- Include JSON stdout with reason to inform Claude AI of the advisory
- Claude can choose to mention the warning to the user or not
- This is "soft" — the operation still proceeds

## 3. Decision Engine Design

### Pipeline Flow

```
ClaudeCodeHookEvent (stdin)
  → parse tool_input.command
  → analyzeCommand(command, config.customRules)
  → AnalysisResult { matches: RuleMatch[] }
  → applyAllowList(matches, config.allowList)
  → filtered RuleMatch[]
  → makeDecision(filteredMatches, config.severityActions)
  → Decision { action, severity, matchedRules, message, suggestion }
  → formatHookOutput(decision)
  → HookOutput (stdout JSON) + exit code
  → writeAuditLog(decision, config.logging)
```

### Allow-List Matching

AllowListMatcher has three fields (any combination):
- `command` — glob/substring match against the full command string
- `filePath` — match against tool_input.file_path (for Write/Edit, future use)
- `ruleId` — suppress specific rule by ID

Matching logic:
- If `ruleId` is set: suppress matches with that specific rule.id
- If `command` is set: suppress all matches if the command string includes the pattern
- If both: both conditions must match (AND logic)
- `expires` field: ISO date string; skip entry if expired

### Severity Priority Order

When multiple rules match: CRITICAL > HIGH > MEDIUM > LOW > INFO

Implementation: sort matches by severity, take highest as the "primary" match for action determination.

## 4. Audit Logging Design

### JSONL Record Schema

**Block/Warn record (detailed):**
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "action": "block",
  "severity": "CRITICAL",
  "command": "rm -rf /",
  "cwd": "/Users/dev/project",
  "sessionId": "sess_abc123",
  "rules": [
    { "id": "shell.rm-recursive-root", "matched": "rm -rf /", "description": "..." }
  ],
  "suggestion": "Use rm with specific file paths"
}
```

**Allow record (minimal):**
```json
{
  "timestamp": "2024-01-15T10:30:01.000Z",
  "action": "allow",
  "command": "ls -la"
}
```

### Log Rotation

Simple strategy (per D-56):
1. Before each write, check file size via `fs.statSync`
2. If size > maxSizeMb → rename to `.1` (overwrite any existing backup)
3. Write to fresh file

Optimization: don't check size on every single write — check every N writes or cache the size. But given <50ms budget and that stat is ~0.1ms, checking every time is fine.

### Path Expansion

`~/.config/yolo-safeguard/audit.jsonl` contains `~` which needs OS-level expansion:
- Replace leading `~` with `os.homedir()`
- Ensure directory exists (mkdir -p equivalent) before first write
- Use `fs.mkdirSync(dir, { recursive: true })` on first write attempt

## 5. Message Formatting

### Reason String Construction (per D-49)

Template for block:
```
"Blocked: {matchedText} — {primaryRule.description}. Suggest: {primaryRule.suggestion}"
```

When multiple rules matched (per D-51):
```
"Blocked: {matchedText} — {primaryRule.description}. Also triggered: {otherRuleIds.join(', ')}. Suggest: {primaryRule.suggestion}"
```

For warn:
```
"Warning: {matchedText} — {primaryRule.description}. Consider: {primaryRule.suggestion}"
```

### No suggestion field

Some rules may not have a `suggestion` field. In that case, omit the "Suggest:" part.

## 6. Module Organization Recommendation

```
src/decision/
├── index.ts          — exports decide(), formatOutput(), the public API
├── allow-list.ts     — applyAllowList(matches, allowList) → filtered matches
├── decide.ts         — makeDecision(matches, severityActions) → Decision
├── format.ts         — formatHookOutput(decision) → HookOutput + exitCode
└── logger.ts         — writeAuditLog(decision, loggingConfig) → void
```

All functions are synchronous (per project constraint). No async anywhere.

## 7. Performance Considerations

- Decision engine adds negligible time (array sort + map operations)
- Audit log write: `fs.appendFileSync` — typically 0.1-0.5ms
- Path expansion: do once at module load, cache the resolved path
- Total Phase 3 overhead: <2ms for typical case (well within 50ms budget)

## 8. Edge Cases

1. **Zero matches** (allow path): exit 0, no stdout JSON needed, log minimal record
2. **All matches suppressed by allow-list**: same as zero matches
3. **Multiple rules, same severity**: pick first match as "primary" (stable ordering from rule definition order)
4. **Logging disabled**: skip all file operations
5. **Log directory doesn't exist**: create on first write, fail-open if can't
6. **INFO severity** (action "off"): no output, no log — completely silent
7. **Expired allow-list entries**: skip silently (don't error)

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Log file permission denied | Fail-open: catch error, continue without logging |
| Log path contains `~` not expanded | Expand at load time, not per-write |
| Clock skew in timestamps | Use Date.now() consistently; no external dependency |
| Allow-list glob matching complexity | Simple includes() for v1; glob patterns in Phase 6 |

## 10. Integration Points

### What Phase 3 Produces (consumed by Phase 4)

Phase 4 (Hook Integration) needs a single entry point function:
```typescript
function processHookEvent(event: ClaudeCodeHookEvent): { output: string; exitCode: number }
```

This function will:
1. Parse the event
2. Call analyzeCommand() (Phase 2)
3. Call decide() (Phase 3)
4. Call formatOutput() (Phase 3)
5. Call writeAuditLog() (Phase 3)
6. Return stdout string + exit code

Phase 3 should export the building blocks; Phase 4 wires them into the hook entry point.

---

*Research completed: 2026-05-21*
