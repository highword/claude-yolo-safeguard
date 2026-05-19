# Phase 1: Foundation & Core Types - Research

**Phase:** 1
**Researched:** 2026-05-20
**Confidence:** HIGH (greenfield project with clear decisions from discuss-phase)

---

## 1. Implementation Approach

Phase 1 delivers the project scaffold, shared type interfaces, configuration system, and built-in rule definitions. All implementation decisions (D-01 through D-24) are locked from the discuss-phase CONTEXT.md.

### Key Technical Decisions Already Made

| Area | Decision | Reference |
|------|----------|-----------|
| Build target | `node` (CJS) via Bun bundler | D-21, STACK.md |
| Type system | Strict TypeScript 5.5+ | STACK.md |
| Lint/format | Biome | STACK.md |
| Rule shape | Unified declarative (JSON-serializable regex source + filters) | D-01, D-02, D-03 |
| Pipeline | Quick Reject (keyword set) → Rule Matching (regex + filters) | D-07, D-08, D-09 |
| Config merge | Built-in → User-level → Project-level | D-10, D-11, D-12, D-13, D-14 |
| Hook I/O | stdin JSON → analysis → stdout JSON + exit code | D-15, D-16, D-17 |
| Severity | 5-level: CRITICAL, HIGH, MEDIUM, LOW, INFO | D-18, D-19, D-20 |
| Structure | src/ with rules/, config/, types/, pipeline/, utils/ | D-21, D-22, D-23, D-24 |

---

## 2. Project Scaffold Details

### 2.1 Directory Structure (Phase 1 scope)

```
claude-yolo-safeguard/
├── src/
│   ├── index.ts                 # Entry point (Phase 4 fills in logic)
│   ├── types/
│   │   ├── index.ts             # Barrel export
│   │   ├── hook.ts              # HookInput, ClaudeCodeHookEvent
│   │   ├── rule.ts              # Rule, Filter, RuleMatch
│   │   ├── decision.ts          # Decision, Action
│   │   ├── config.ts            # Config, SeverityActionMap
│   │   └── severity.ts          # Severity enum, severity constants
│   ├── rules/
│   │   ├── index.ts             # Rule registry + Quick Reject Set builder
│   │   ├── fs.ts                # Filesystem rules (rm, del, rmdir)
│   │   ├── git.ts               # Git rules (force-push, reset, branch -D)
│   │   ├── db.ts                # Database rules (DROP, TRUNCATE)
│   │   ├── exec.ts              # Execution rules (curl|sh, eval, python -c)
│   │   └── content.ts           # Content security rules (secrets, XSS, SQLi)
│   ├── config/
│   │   ├── index.ts             # Barrel export
│   │   ├── defaults.ts          # Default configuration values
│   │   └── loader.ts            # 3-layer config merge logic
│   ├── pipeline/
│   │   └── index.ts             # Pipeline type exports (Quick Reject interface)
│   └── utils/
│       └── index.ts             # Shared utilities (path normalization, etc.)
├── tests/
│   ├── types.test.ts            # Type interface validation
│   ├── rules.test.ts            # Rule definitions + Quick Reject Set
│   ├── config.test.ts           # Config loader merge behavior
│   └── severity.test.ts         # Severity-to-action mapping
├── package.json
├── tsconfig.json
├── biome.json
├── bunfig.toml
└── build.ts                     # Bun bundler script
```

### 2.2 package.json Structure

```json
{
  "name": "claude-yolo-safeguard",
  "version": "0.0.1",
  "description": "Universal AI agent safety guardrail for YOLO mode",
  "main": "dist/hook.cjs",
  "bin": {
    "claude-yolo-safeguard": "./dist/cli.cjs"
  },
  "scripts": {
    "build": "bun run build.ts",
    "test": "bun test",
    "lint": "bunx biome check .",
    "lint:fix": "bunx biome check --write .",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=18"
  },
  "files": ["dist/"],
  "license": "MIT",
  "dependencies": {
    "shell-quote": "^1.8.1"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/shell-quote": "^1.7.5",
    "bun-types": "latest",
    "typescript": "^5.5.0"
  }
}
```

### 2.3 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationDir": "./dist/types",
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 2.4 biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "security": {
        "noGlobalEval": "error"
      }
    }
  },
  "formatter": {
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"
    }
  }
}
```

### 2.5 build.ts (Bun Bundler)

```typescript
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "cjs",
  minify: true,
  sourcemap: "external",
  naming: "[dir]/hook.[ext]",
});
```

---

## 3. Type Interfaces (Detailed Design)

### 3.1 Severity System

```typescript
// src/types/severity.ts
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type Action = "block" | "warn" | "log" | "off";

export type SeverityActionMap = Record<Severity, Action>;

export const DEFAULT_SEVERITY_ACTIONS: SeverityActionMap = {
  CRITICAL: "block",
  HIGH: "block",
  MEDIUM: "warn",
  LOW: "log",
  INFO: "off",
};
```

### 3.2 Rule Interface

```typescript
// src/types/rule.ts
export type RuleCategory = "shell" | "content";
export type Platform = "posix" | "powershell" | "cmd";

export interface Filter {
  type: string;
  value: string;
}

export interface NotContainsFilter extends Filter {
  type: "notContains";
  value: string; // command must NOT contain this string
}

export interface ContainsFilter extends Filter {
  type: "contains";
  value: string; // command MUST contain this string for rule to match
}

export type RuleFilter = NotContainsFilter | ContainsFilter;

export interface Rule {
  id: string;
  category: RuleCategory;
  severity: Severity;
  pattern: string;           // regex source (JSON-serializable)
  filters?: RuleFilter[];    // post-match refinement
  keywords: string[];        // for Quick Reject Set aggregation
  description: string;
  suggestion?: string;
  platforms?: Platform[];    // defaults to all if omitted
  builtin: boolean;
}

export interface RuleMatch {
  rule: Rule;
  matchedText: string;
  index: number;
}
```

### 3.3 Hook I/O Types

```typescript
// src/types/hook.ts
export type ToolName = "Bash" | "Write" | "Edit";

export interface HookInput {
  tool: ToolName;
  command?: string;
  filePath?: string;
  content?: string;
  cwd: string;
  platform: "claude-code";
}

export interface ClaudeCodeHookEvent {
  hook_type: "PreToolUse";
  tool_name: ToolName;
  tool_input: {
    command?: string;
    file_path?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
  };
  session_id?: string;
  cwd?: string;
}

export interface HookOutput {
  decision: "allow" | "block";
  reason?: string;
  rule?: string;
  severity?: Severity;
  category?: RuleCategory;
  suggestion?: string;
  matchedPatterns?: string[];
}
```

### 3.4 Decision Types

```typescript
// src/types/decision.ts
export interface Decision {
  action: Action;
  severity?: Severity;
  matchedRules: RuleMatch[];
  message?: string;
  suggestion?: string;
  timestamp: string;
}
```

### 3.5 Config Types

```typescript
// src/types/config.ts
export interface Config {
  severityActions: SeverityActionMap;
  customRules: Rule[];
  allowList: AllowListEntry[];
  logging: LoggingConfig;
}

export interface LoggingConfig {
  enabled: boolean;
  path: string;
  maxSizeMb: number;
}

export interface AllowListEntry {
  id: string;
  match: AllowListMatcher;
  reason: string;
  expires?: string;
}

export interface AllowListMatcher {
  command?: string;
  filePath?: string;
  ruleId?: string;
}
```

---

## 4. Configuration Loader Design

### 4.1 Merge Strategy

```
Layer 1: Built-in defaults (hardcoded in defaults.ts)
    ↓ override
Layer 2: User-level (~/.config/yolo-safeguard/config.json)
    ↓ override (restricted)
Layer 3: Project-level (.safeguard.json in cwd)
```

### 4.2 Project-Level Restrictions (D-11, D-12, D-13)

Project-level config CAN:
- Add custom rules (merged additively)
- Add allow-list entries (merged additively)
- Escalate severity (MEDIUM → HIGH is allowed)

Project-level config CANNOT:
- Disable built-in rules
- Lower severity (HIGH → MEDIUM is rejected)
- Change block → warn for any rule
- Exempt CRITICAL severity rules (only user-level can)

### 4.3 Config Resolution Logic

```typescript
function loadConfig(cwd: string): Config {
  const defaults = getDefaults();
  const userConfig = readUserConfig(); // ~/.config/yolo-safeguard/config.json
  const projectConfig = readProjectConfig(cwd); // .safeguard.json

  return mergeConfigs(defaults, userConfig, projectConfig);
}

function mergeConfigs(base: Config, user: Partial<Config>, project: Partial<Config>): Config {
  // 1. User-level can override anything in defaults
  const merged = deepMerge(base, user);
  
  // 2. Project-level has restrictions
  if (project.severityActions) {
    // Only allow escalation (stricter), reject de-escalation
    for (const [sev, action] of Object.entries(project.severityActions)) {
      if (isEscalation(merged.severityActions[sev], action)) {
        merged.severityActions[sev] = action;
      }
      // silently ignore de-escalation attempts
    }
  }
  
  // 3. Additive merges
  if (project.customRules) merged.customRules.push(...project.customRules);
  if (project.allowList) merged.allowList.push(...project.allowList);
  
  return merged;
}
```

---

## 5. Rule Definitions (Phase 1 Data)

Phase 1 defines the rule DATA only — matching logic is implemented in Phase 2. Rules are declared as static data using the `Rule` interface.

### 5.1 Shell Rules (Sample - fs.ts)

| ID | Severity | Pattern (regex source) | Keywords | Description |
|----|----------|----------------------|----------|-------------|
| shell.rm-recursive-root | CRITICAL | `rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+.*)?(/\|~)` | `["rm"]` | Recursive rm targeting / or ~ |
| shell.rm-recursive-force | HIGH | `rm\s+-[a-zA-Z]*r[a-zA-Z]*f` | `["rm"]` | rm -rf (force recursive) |
| shell.rmdir-root | CRITICAL | `rmdir\s+.*(/\|~)` | `["rmdir"]` | rmdir targeting root/home |

### 5.2 Shell Rules (git.ts)

| ID | Severity | Pattern | Keywords | Description |
|----|----------|---------|----------|-------------|
| shell.git-force-push | CRITICAL | `git\s+push\s+.*--force(?!-with-lease)` | `["git", "push", "force"]` | git push --force (not --force-with-lease) |
| shell.git-reset-hard | HIGH | `git\s+reset\s+--hard` | `["git", "reset", "hard"]` | git reset --hard |
| shell.git-clean-force | HIGH | `git\s+clean\s+-[a-zA-Z]*f` | `["git", "clean"]` | git clean -f |
| shell.git-branch-D | MEDIUM | `git\s+branch\s+-D` | `["git", "branch"]` | git branch -D (force delete) |
| shell.git-stash-drop | MEDIUM | `git\s+stash\s+(drop\|clear)` | `["git", "stash"]` | git stash drop/clear |

### 5.3 Shell Rules (db.ts)

| ID | Severity | Pattern | Keywords | Description |
|----|----------|---------|----------|-------------|
| shell.drop-database | CRITICAL | `DROP\s+DATABASE` | `["DROP", "DATABASE"]` | DROP DATABASE |
| shell.drop-table | CRITICAL | `DROP\s+TABLE` | `["DROP", "TABLE"]` | DROP TABLE |
| shell.truncate-table | HIGH | `TRUNCATE\s+TABLE` | `["TRUNCATE", "TABLE"]` | TRUNCATE TABLE |

### 5.4 Shell Rules (exec.ts)

| ID | Severity | Pattern | Keywords | Description |
|----|----------|---------|----------|-------------|
| shell.curl-pipe-sh | HIGH | `curl\s+.*\|\s*(sh\|bash)` | `["curl", "sh", "bash"]` | curl piped to shell |
| shell.wget-pipe-sh | HIGH | `wget\s+.*\|\s*(sh\|bash)` | `["wget", "sh", "bash"]` | wget piped to shell |
| shell.eval | MEDIUM | `\beval\b` | `["eval"]` | eval usage |

### 5.5 Content Rules (content.ts)

| ID | Severity | Pattern | Keywords | Description |
|----|----------|---------|----------|-------------|
| content.hardcoded-secret | HIGH | `(?:api[_-]?key\|token\|secret\|password)\s*[=:]\s*['"][^'"]{8,}` | `["key", "token", "secret", "password"]` | Hardcoded credentials |
| content.eval-usage | HIGH | `\beval\s*\(` | `["eval"]` | eval() function call |
| content.innerHTML | HIGH | `\.innerHTML\s*=` | `["innerHTML"]` | innerHTML assignment (XSS) |
| content.sql-concat | HIGH | `(?:SELECT\|INSERT\|UPDATE\|DELETE).*\+\s*\w` | `["SELECT", "INSERT", "UPDATE", "DELETE"]` | SQL string concatenation |
| content.dangerouslySetInnerHTML | HIGH | `dangerouslySetInnerHTML` | `["dangerouslySetInnerHTML"]` | React XSS pattern |

### 5.6 Quick Reject Set

All rule `keywords` fields are aggregated into a single Set<string> at module initialization:

```typescript
const QUICK_REJECT_SET: Set<string> = new Set(
  ALL_RULES.flatMap(rule => rule.keywords)
);

function quickReject(input: string): boolean {
  // If input contains NONE of the keywords, skip all regex matching
  const lower = input.toLowerCase();
  for (const keyword of QUICK_REJECT_SET) {
    if (lower.includes(keyword.toLowerCase())) {
      return false; // Don't reject — proceed to regex matching
    }
  }
  return true; // Reject — no keywords found, guaranteed no match
}
```

---

## 6. Validation Architecture

### 6.1 Phase 1 Success Criteria Verification

| Criterion | How to Verify |
|-----------|---------------|
| Project builds with Bun | `bun run build.ts` exits 0, produces dist/hook.cjs |
| Type interfaces importable | `import { Rule, Decision, Config, Severity, HookInput } from "./src/types"` compiles |
| Config loader merges correctly | Unit tests: 3-layer merge, escalation-only for project |
| Built-in rules exist as data | `import { ALL_RULES } from "./src/rules"` returns 15+ rules |
| Severity mapping configured | `DEFAULT_SEVERITY_ACTIONS.CRITICAL === "block"` |

### 6.2 Test Strategy

- **Type tests:** Verify interfaces compile and enforce correct shapes
- **Rule data tests:** Verify each rule has required fields (id, category, severity, pattern, keywords)
- **Config merge tests:** Verify 3-layer merge, escalation-only, additive allow-list
- **Quick Reject tests:** Verify keyword aggregation produces correct Set
- **Build test:** Verify `bun run build.ts` produces single .cjs file

---

## 7. Dependencies & External References

### 7.1 Runtime Dependencies

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| shell-quote | ^1.8.1 | POSIX shell tokenization | LOW — stable, used by npm itself, 90M downloads/week |

### 7.2 Bun Bundler Compatibility

- Bun 1.2+ supports `target: "node"` and `format: "cjs"` output
- All imports (including shell-quote) are bundled into the output
- The produced .cjs file runs on Node.js 18+ without Bun installed

### 7.3 Biome Configuration

- Biome 1.9+ supports TypeScript natively
- `noGlobalEval: "error"` enforces the project's "no eval" principle
- Tab indentation + double quotes are the formatter defaults we'll use

---

## 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Bun bundler edge case with shell-quote | LOW | Test bundle works with `node dist/hook.cjs` after build |
| TypeScript strict mode causing friction | LOW | Accept strict from day 1 — prevents technical debt |
| Over-engineering types for future phases | MEDIUM | Stick to CONTEXT.md decisions exactly — no speculative interfaces |
| Rule regex patterns too loose/tight | LOW | Phase 1 only defines data; Phase 2 tests matching behavior |

---

## RESEARCH COMPLETE

Phase 1 is well-scoped with clear decisions. Implementation is straightforward scaffold + type definitions + config loader + rule data. No unknowns requiring further investigation.
