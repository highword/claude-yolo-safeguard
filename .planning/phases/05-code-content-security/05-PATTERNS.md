# Phase 5: Code Content Security - Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/content/scanner.ts` | service | transform | `src/pipeline/index.ts` | exact |
| `src/content/entropy.ts` | utility | transform | `src/rules/index.ts` (quickReject) | role-match |
| `src/content/rules.ts` | config | static | `src/rules/content.ts` | exact |
| `src/hook/process.ts` (modify) | controller | request-response | `src/hook/process.ts` (self) | exact |
| `tests/content/*.test.ts` | test | N/A | `tests/decision/allow-list.test.ts` | exact |
| `tests/hook/content-hook.test.ts` | test | N/A | `tests/hook/entry.test.ts` | exact |
| `tests/content/performance.test.ts` | test | N/A | `tests/hook/performance.test.ts` | exact |

## Pattern Assignments

### `src/content/scanner.ts` (service, transform)

**Analog:** `src/pipeline/index.ts`

**Imports pattern** (lines 1-6):
```typescript
import type { Rule, RuleMatch } from "../types/rule";
import type { AnalysisResult, AnalysisFrame, ParseEntry, TokenSpan } from "./types";
import { parseCommand, splitSegments, buildTokenSpans } from "./parser";
import { extractNestedCommands, extractSubshells } from "./nested";
import { matchRules, COMPILED_SHELL_RULES, compileRules } from "./matcher";
import { quickReject } from "../rules/index";
```

**Applicable pattern for content scanner:**
```typescript
import type { RuleMatch } from "../types/rule";
import { compileRules } from "../pipeline/matcher";
import { CONTENT_RULES } from "./rules";
import { shannonEntropy } from "./entropy";
```

**Core analysis pattern — entry point with early-return optimization** (lines 89-105 of `src/pipeline/index.ts`):
```typescript
export function analyzeCommand(
  command: string,
  customRules?: Rule[],
): AnalysisResult {
  // Step 1: Quick Reject - if no keywords found, guaranteed no match
  if (quickReject(command)) {
    if (!customRules) {
      return { matches: [], segmentCount: 0, maxDepth: 0 };
    }
    const lower = command.toLowerCase();
    const hasCustomKeyword = customRules.some((rule) =>
      rule.keywords.some((kw) => lower.includes(kw.toLowerCase())),
    );
    if (!hasCustomKeyword) {
      return { matches: [], segmentCount: 0, maxDepth: 0 };
    }
  }
```

**Pre-compilation at module load pattern** (lines 145-148 of `src/pipeline/matcher.ts`):
```typescript
export const COMPILED_SHELL_RULES: CompiledRule[] = compileRules(
  ALL_RULES.filter((r) => r.category === "shell"),
);
```

**Match collection pattern** (lines 111-138 of `src/pipeline/matcher.ts`):
```typescript
export function matchRules(
  segmentStr: string,
  spans: TokenSpan[],
  compiledRules: CompiledRule[],
  isShellWrapperArg = false,
): RuleMatch[] {
  const results: RuleMatch[] = [];

  for (const compiled of compiledRules) {
    const match = compiled.regex.exec(segmentStr);
    if (!match) {
      continue;
    }

    // Step 1: Apply filters (D-36 post-match guards)
    if (!applyFilters(compiled.rule, segmentStr)) {
      continue;
    }

    // Step 2: Token position verification (D-33, D-34, D-39)
    if (shouldSuppressMatch(spans, match.index, isShellWrapperArg)) {
      continue;
    }

    // Step 3: Match passes all checks — record it
    results.push({
      rule: compiled.rule,
      matchedText: match[0],
      index: match.index,
    });
  }

  return results;
}
```

---

### `src/content/entropy.ts` (utility, transform)

**Analog:** `src/rules/index.ts` (pure function utility pattern)

**Pattern — pure exported function with no dependencies** (lines 27-35 of `src/rules/index.ts`):
```typescript
/**
 * Quick Reject: if input contains NONE of the aggregated keywords,
 * skip all regex matching (guaranteed no rule will match).
 *
 * @returns true if input should be SKIPPED (no keywords found — allow immediately)
 * @returns false if input should PROCEED to regex matching (keyword found)
 */
export function quickReject(input: string): boolean {
  const lower = input.toLowerCase();
  for (const keyword of QUICK_REJECT_SET) {
    if (lower.includes(keyword.toLowerCase())) {
      return false; // Don't reject — proceed to regex matching
    }
  }
  return true; // Reject — no keywords found, guaranteed no match
}
```

**Applicable pattern for entropy.ts:**
- Self-contained pure function, single responsibility
- JSDoc with `@returns` annotation
- No external dependencies (math only)
- Export both the core function and a convenience boolean wrapper

---

### `src/content/rules.ts` (config, static)

**Analog:** `src/rules/content.ts` (exact match — same file being expanded)

**Full rule definition pattern** (lines 1-59 of `src/rules/content.ts`):
```typescript
import type { Rule } from "../types/rule";

export const CONTENT_RULES: Rule[] = [
  {
    id: "content.hardcoded-secret",
    category: "content",
    severity: "HIGH",
    pattern:
      "(?:api[_-]?key|token|secret|password)\\s*[=:]\\s*['\"][^'\"]{8,}",
    keywords: ["key", "token", "secret", "password"],
    description: "Potential hardcoded credential (API key, token, or password)",
    suggestion:
      "Use environment variables or a secrets manager instead of hardcoding",
    builtin: true,
  },
  {
    id: "content.eval-usage",
    category: "content",
    severity: "HIGH",
    pattern: "\\beval\\s*\\(",
    keywords: ["eval"],
    description: "eval() executes arbitrary code — potential injection vector",
    suggestion: "Use JSON.parse for data, or a safe expression evaluator",
    builtin: true,
  },
  // ... more rules following same shape
];
```

**Key pattern notes:**
- Each rule has: `id`, `category`, `severity`, `pattern`, `keywords`, `description`, `suggestion`, `builtin`
- The `Rule` type from `src/types/rule.ts` is the contract
- `category` must be `"content"` for content rules
- `keywords` array is used for quick-reject optimization
- `pattern` is a string (not RegExp) — compiled by `compileRules()`

---

### `src/hook/process.ts` (controller, request-response) — MODIFY

**Analog:** Self (current implementation)

**Current routing pattern** (lines 16-60 of `src/hook/process.ts`):
```typescript
export function processHookEvent(raw: string): { output: string; exitCode: number } {
  try {
    const event: ClaudeCodeHookEvent = JSON.parse(raw);

    // D-65: Only Bash tool gets full analysis; Write/Edit return immediately
    if (event.tool_name !== "Bash") {
      return { output: "", exitCode: 0 };
    }

    // Bail if no command to analyze
    const command = event.tool_input?.command;
    if (!command) {
      return { output: "", exitCode: 0 };
    }

    // Load 3-layer merged config
    const cwd = event.cwd || process.cwd();
    const config = loadConfig(cwd);

    // Analyze command through pipeline
    const analysis = analyzeCommand(
      command,
      config.customRules.length > 0 ? config.customRules : undefined,
    );

    // Apply allow-list filtering
    const filtered = applyAllowList(analysis.matches, config.allowList, command);

    // Make graduated decision
    const decision = makeDecision(filtered, config.severityActions);

    // Audit log (fire-and-forget, fail-open internally)
    writeAuditLog(decision, config.logging, {
      command,
      cwd,
      sessionId: event.session_id,
    });

    // Format and return
    return formatHookOutput(decision);
  } catch {
    // D-66: Any error = fail-open
    return { output: "", exitCode: 0 };
  }
}
```

**Modification approach:** Replace the early-return `if (event.tool_name !== "Bash")` block (line 21-23) with a branching structure that handles Write/Edit by calling `scanContent()`, then feeds results through the same `applyAllowList -> makeDecision -> writeAuditLog -> formatHookOutput` pipeline.

**Import additions needed:**
```typescript
import { scanContent } from "../content/scanner";
```

---

### `tests/content/*.test.ts` (test, unit)

**Analog:** `tests/decision/allow-list.test.ts`

**Test file structure pattern** (lines 1-9 of `tests/decision/allow-list.test.ts`):
```typescript
import { describe, expect, test } from "bun:test";
import { applyAllowList } from "../../src/decision/allow-list";
import type { AllowListEntry } from "../../src/types/config";
import type { Rule, RuleMatch } from "../../src/types/rule";
import type { Severity } from "../../src/types/severity";
```

**Mock helper pattern** (lines 10-30 of `tests/decision/allow-list.test.ts`):
```typescript
/**
 * Test helpers
 */
const mockRule = (id: string, severity: Severity = "HIGH"): Rule => ({
  id,
  category: "shell",
  severity,
  pattern: ".*",
  keywords: ["test"],
  description: `Rule ${id}`,
  suggestion: "Use safer alternative",
  platforms: ["posix"],
  builtin: true,
});

const mockMatch = (
  ruleId: string,
  text: string,
  severity?: Severity,
): RuleMatch => ({
  rule: mockRule(ruleId, severity),
  matchedText: text,
  index: 0,
});
```

**Test case pattern** (lines 33-43 of `tests/decision/allow-list.test.ts`):
```typescript
describe("applyAllowList", () => {
  test("empty matches array returns empty array regardless of allow-list", () => {
    const allowList: AllowListEntry[] = [
      {
        id: "entry-1",
        match: { ruleId: "shell.rm-recursive-root" },
        reason: "Allowed for testing",
      },
    ];
    const result = applyAllowList([], allowList);
    expect(result).toEqual([]);
  });
```

**Key test conventions:**
- `describe` wraps function/module name
- `test` (not `it`) for individual cases
- Descriptive test names as full sentences describing input -> expected output
- Type imports for mock construction
- No `beforeEach`/`afterEach` unless truly needed (prefer inline setup)

---

### `tests/hook/content-hook.test.ts` (test, integration)

**Analog:** `tests/hook/entry.test.ts`

**Integration test pattern — testing processHookEvent end-to-end** (lines 1-42 of `tests/hook/entry.test.ts`):
```typescript
import { describe, expect, test } from "bun:test";
import { processHookEvent } from "../../src/hook/process";

describe("processHookEvent", () => {
  test("Bash tool with dangerous command (rm -rf /) produces exit code 2 and block JSON", () => {
    const event = JSON.stringify({
      hook_type: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "rm -rf /" },
      cwd: "/tmp",
    });
    const result = processHookEvent(event);
    expect(result.exitCode).toBe(2);
    const parsed = JSON.parse(result.output);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(parsed.systemMessage).toBeDefined();
  });

  test("Bash tool with safe command (ls -la) produces exit code 0 and no output", () => {
    const event = JSON.stringify({
      hook_type: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
      cwd: "/tmp",
    });
    const result = processHookEvent(event);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("");
  });
```

**Key integration test pattern:**
- Construct full `ClaudeCodeHookEvent` JSON
- Call `processHookEvent(JSON.stringify(event))`
- Assert on `exitCode` (0 = allow, 2 = block) and parse `output` JSON
- For blocked: check `permissionDecision === "deny"` and `systemMessage` exists
- For allowed: check `output === ""` and `exitCode === 0`

---

### `tests/content/performance.test.ts` (test, performance)

**Analog:** `tests/hook/performance.test.ts`

**Performance test pattern** (lines 1-20 of `tests/hook/performance.test.ts`):
```typescript
import { describe, expect, test } from "bun:test";
import { processHookEvent } from "../../src/hook/process";

describe("hook performance", () => {
  test("safe command (ls -la) processes in <50ms", () => {
    const input = JSON.stringify({
      hook_type: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls -la" },
      cwd: process.cwd(),
    });

    const start = performance.now();
    const result = processHookEvent(input);
    const elapsed = performance.now() - start;

    expect(result.exitCode).toBe(0);
    expect(elapsed).toBeLessThan(50);
  });
```

**Key performance test pattern:**
- Use `performance.now()` for timing
- Assert `elapsed` with `toBeLessThan(threshold)`
- Include both warm-up and cold-start variants
- Test with representative payloads (small/large/adversarial)

---

## Shared Patterns

### Pre-compilation at Module Load
**Source:** `src/pipeline/matcher.ts` lines 145-148
**Apply to:** `src/content/scanner.ts`
```typescript
// Pre-compiled at module load (not per invocation) per D-43
export const COMPILED_CONTENT_RULES: CompiledRule[] = compileRules(
  CONTENT_RULES.filter((r) => r.category === "content"),
);
```

### Quick-Reject Optimization
**Source:** `src/rules/index.ts` lines 16-35
**Apply to:** `src/content/scanner.ts` (keyword check before line-by-line scanning)
```typescript
export const QUICK_REJECT_SET: Set<string> = new Set(
  ALL_RULES.flatMap((rule) => rule.keywords),
);

export function quickReject(input: string): boolean {
  const lower = input.toLowerCase();
  for (const keyword of QUICK_REJECT_SET) {
    if (lower.includes(keyword.toLowerCase())) {
      return false; // Don't reject — proceed to regex matching
    }
  }
  return true; // Reject — no keywords found, guaranteed no match
}
```

### Decision Pipeline (Reuse Verbatim)
**Source:** `src/hook/process.ts` lines 42-55
**Apply to:** Write/Edit branch in `processHookEvent`
```typescript
// Apply allow-list filtering
const filtered = applyAllowList(analysis.matches, config.allowList, command);

// Make graduated decision
const decision = makeDecision(filtered, config.severityActions);

// Audit log (fire-and-forget, fail-open internally)
writeAuditLog(decision, config.logging, {
  command,
  cwd,
  sessionId: event.session_id,
});

// Format and return
return formatHookOutput(decision);
```

### Fail-Open Error Handling
**Source:** `src/hook/process.ts` lines 56-59
**Apply to:** All new code paths in `processHookEvent` and `scanContent`
```typescript
} catch {
  // D-66: Any error = fail-open
  return { output: "", exitCode: 0 };
}
```

### Rule Type Contract
**Source:** `src/types/rule.ts` lines 24-34
**Apply to:** All rule definitions in `src/content/rules.ts`
```typescript
export interface Rule {
  id: string;
  category: RuleCategory;
  severity: Severity;
  pattern: string;
  filters?: RuleFilter[];
  keywords: string[];
  description: string;
  suggestion?: string;
  platforms?: Platform[];
  builtin: boolean;
}
```

### CompiledRule Type
**Source:** `src/pipeline/types.ts` (inferred from matcher.ts usage)
**Apply to:** Content scanner's use of `compileRules`
```typescript
// compileRules returns: { rule: Rule, regex: RegExp }[]
export interface CompiledRule {
  rule: Rule;
  regex: RegExp;
}
```

### Test Helper Pattern (Mock Rule/Match Builders)
**Source:** `tests/decision/allow-list.test.ts` lines 10-30
**Apply to:** All new test files in `tests/content/`
```typescript
const mockRule = (id: string, severity: Severity = "HIGH"): Rule => ({
  id,
  category: "content",  // <-- changed from "shell" to "content"
  severity,
  pattern: ".*",
  keywords: ["test"],
  description: `Rule ${id}`,
  suggestion: "Use safer alternative",
  builtin: true,
});

const mockMatch = (
  ruleId: string,
  text: string,
  severity?: Severity,
): RuleMatch => ({
  rule: mockRule(ruleId, severity),
  matchedText: text,
  index: 0,
});
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have strong analogs in the existing codebase |

All 7 files have exact or role-match analogs. The project architecture is consistent enough that every new module follows an established pattern.

## Metadata

**Analog search scope:** `src/`, `tests/`
**Files scanned:** 15 source files, 12 test files
**Pattern extraction date:** 2026-06-01
