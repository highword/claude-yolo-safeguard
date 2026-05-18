# Phase 1: Foundation & Core Types - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the project scaffold with all shared interfaces, configuration system, and rule definitions so subsequent phases can build on stable contracts. Delivers: TypeScript project structure, core type interfaces, config loader, built-in rule data definitions, and severity-to-action mapping.

</domain>

<decisions>
## Implementation Decisions

### Rule Definition Structure
- **D-01:** Unified declarative Rule shape — built-in and user-defined rules share the same interface (JSON-serializable)
- **D-02:** Pattern matching via regex (stored as string source in the Rule object)
- **D-03:** Post-match refinement via extensible `Filter` types — enables function-level precision while remaining declarative
- **D-04:** Phase 1 defines Filter interface + 2 core types (`notContains`, `contains`); Phase 2 expands with path/flag filters as needed
- **D-05:** Rules organized by category in separate files (src/rules/fs.ts, src/rules/git.ts, etc.)
- **D-06:** Each rule declares a `keywords` field — aggregated at build/init time into a Quick Reject Set for fast-path filtering

### Analysis Pipeline Architecture
- **D-07:** Two-layer pipeline: Quick Reject (keyword set lookup, <1ms) → Rule Matching (regex + filters)
- **D-08:** No Safe Patterns layer — unnecessary at <50 rules; can be added later as a pure performance optimization if rules grow >200
- **D-09:** Quick Reject: if command contains none of the aggregated keywords from all rules → immediate ALLOW, skip all regex

### Configuration Hierarchy & Merge Strategy
- **D-10:** Three-layer merge: built-in defaults → user-level (~/.config/yolo-safeguard/config.json) → project-level (.safeguard.json)
- **D-11:** Project-level can: add custom rules, add allow-list entries, escalate severity (make stricter)
- **D-12:** Project-level CANNOT: disable built-in rules, lower severity, change block→warn
- **D-13:** CRITICAL severity rules are never exemptable by project-level config — only user-level can exempt
- **D-14:** Allow-list merges are additive (not override)

### Hook I/O Contract
- **D-15:** Structured JSON output on stdout: `{ reason, rule, severity, category, suggestion, matchedPatterns[] }`
- **D-16:** Claude Code reads only `reason` field; extra fields serve audit logging and future integrations
- **D-17:** Exit codes per Claude Code protocol: 0=ALLOW, 2=BLOCK

### Severity System
- **D-18:** 5-level severity: CRITICAL, HIGH, MEDIUM, LOW, INFO
- **D-19:** Default severity-to-action mapping:
  - CRITICAL → block (immutable, cannot be overridden)
  - HIGH → block (user can configure to 'warn')
  - MEDIUM → warn (user can configure to 'block' or 'log')
  - LOW → log (user can configure to 'warn' or 'off')
  - INFO → off (not displayed, not recorded)
- **D-20:** Action type union: `'block' | 'warn' | 'log' | 'off'`

### Project Scaffold
- **D-21:** src/ organized by responsibility: rules/, config/, types/, pipeline/, utils/
- **D-22:** Tests colocated (xxx.test.ts alongside xxx.ts)
- **D-23:** Entry point: src/index.ts
- **D-24:** Barrel exports via index.ts per directory

### Claude's Discretion
- Exact file naming within directories (e.g., src/rules/shell-fs.ts vs src/rules/fs.ts)
- Internal utility organization
- Test fixture placement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specs
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — 32 v1 requirements with traceability (RESP-01, INST-03 mapped to Phase 1)
- `.planning/ROADMAP.md` — Phase goals and success criteria

### Research
- `.planning/research/STACK.md` — Technology stack decisions and rationale
- `.planning/research/ARCHITECTURE.md` — Architecture patterns and pipeline design
- `.planning/research/FEATURES.md` — Feature analysis and competitor comparison
- `.planning/research/PITFALLS.md` — Known pitfalls and anti-patterns to avoid

### Competitor References (for pattern design)
- shellfirm (github.com/kaplanelad/shellfirm) — YAML rule definitions with regex + filters; checks/ directory structure
- claude-code-safety-net (github.com/kenryu42/claude-code-safety-net) — TypeScript rule files; analyze pattern
- destructive_command_guard (github.com/Dicklesworthstone/destructive_command_guard) — Pack system; Quick Reject + regex pipeline; external pack format

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (greenfield project)

### Established Patterns
- None — all conventions established in this phase

### Integration Points
- Claude Code PreToolUse hook protocol (exit code 0/2, stdin JSON, stdout JSON)
- npm registry for distribution
- Bun for build/test/bundle

</code_context>

<specifics>
## Specific Ideas

- Filter type system inspired by shellfirm's proven model (PathExists, NotContains, Contains) but extensible for future types (pathIsSystem, targetOutsideCwd, hasAllFlags)
- Quick Reject keyword set inspired by DCG's memchr fast-path — each Rule declares its own keywords for automatic aggregation
- Structured hook output inspired by DCG's detailed JSON response format
- Configuration trust model inspired by DCG's "CRITICAL never exemptable by project" policy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 1-Foundation & Core Types*
*Context gathered: 2026-05-19*
