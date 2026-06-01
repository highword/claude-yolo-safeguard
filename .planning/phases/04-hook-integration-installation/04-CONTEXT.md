# Phase 4 Context: Hook Integration & Installation

**Phase goal:** Connect the analysis pipeline + decision engine into a working Claude Code hook, plus a CLI installer for zero-config setup.

**Context gathered:** 2026-06-01
**Status:** LOCKED — ready for planning

---

## Gray Areas Discussed & Decided

### GA-1: Hook Entry Point Scope

**Question:** Which tool types get full pipeline analysis in Phase 4?

**Decision (D-65):** Only `Bash` tool gets the full analysis pipeline. `Write` and `Edit` tools return exit 0 (allow) immediately — content analysis is Phase 5 scope.

**Rationale:** Phase 4 is about integration plumbing. Content security is a separate concern with its own detection patterns. Stubbing Write/Edit keeps Phase 4 focused.

---

### GA-2: Error Handling Strategy

**Question:** What happens when the hook throws an internal error?

**Decision (D-66):** Global try-catch at the top level. Any uncaught error → exit 0 (allow). The hook must never become a blocker to the user's workflow.

**Rationale:** Fail-open is a core project constraint. A broken guardrail that blocks all operations is worse than no guardrail at all.

---

### GA-3: Installation Location & Config Strategy

**Question:** Where does the hook get installed, and how does the installer modify settings.json?

**Decisions:**
- **(D-67)** Default install location: `~/.claude/hooks/yolo-safeguard/hook.cjs` (global). `--project` flag installs to `.claude/hooks/yolo-safeguard/hook.cjs` (project-local).
- **(D-68)** Append mode: installer adds to the existing `hooks` array in settings.json, never overwrites existing hook entries.
- **(D-69)** Minimal config touch: only read/write the `hooks` field in settings.json, not rewrite the full file. Use JSON parse → modify → serialize with preserved formatting where possible.

**Rationale:** Safety first. Users may have other hooks configured. Overwriting would destroy their setup. Minimal touch reduces blast radius of any installer bug.

---

### GA-4: Bundle Strategy

**Question:** How many bundle outputs and what are their roles?

**Decision (D-70):** Dual entrypoint architecture:
- `hook.cjs` (~50KB) — the actual hook that Claude Code invokes. Contains analysis pipeline + decision engine. No CLI dependencies.
- `cli.cjs` (~20KB) — the `npx claude-yolo-safeguard init` installer. Contains file copy, settings.json manipulation, platform detection. Not called at runtime.

**Rationale:** Separation of concerns. The hook must be as small and fast as possible (cold start matters for <50ms). The CLI only runs once during install and can be larger.

---

### GA-5: Cross-Platform Hook Invocation

**Question:** How does Claude Code invoke the hook across Windows/macOS/Linux?

**Decision (D-71):** Node direct call. The installer writes `"command": "node <absolute-path-to-hook.cjs>"` into settings.json.

- Windows: `"command": "node C:\\Users\\user\\.claude\\hooks\\yolo-safeguard\\hook.cjs"`
- macOS/Linux: `"command": "node /home/user/.claude/hooks/yolo-safeguard/hook.cjs"`

No shebang, no `.cmd` wrapper, no npx indirection.

**Rationale:**
1. Claude Code requires Node.js — `node` is guaranteed in PATH
2. Works identically on all platforms without OS-specific wrapper files
3. Zero cold-start overhead (no npx resolution)
4. Installer just needs to resolve the absolute path at init time and JSON-escape it

---

## Integration Points

| Component | Location | Role in Phase 4 |
|-----------|----------|-----------------|
| Analysis pipeline | `src/analysis/pipeline.ts` | Called by hook for Bash commands |
| Decision engine | `src/decision/engine.ts` | Produces allow/block/warn verdict |
| Hook output formatter | `src/decision/formatter.ts` | Formats JSON stdout for Claude Code |
| Config loader | `src/config/loader.ts` | Loads 3-layer merged config at hook startup |
| Audit logger | `src/decision/audit-logger.ts` | Logs every decision to JSONL file |

## Constraints Carried Forward

- **<50ms total** from stdin read to exit code (includes config load + analysis + decision)
- **Single-file bundle** — no `node_modules` at runtime
- **Exit code 0** = allow, **exit code 2** = block (Claude Code protocol)
- **Stdout JSON** required when blocking (must include `reason` field)
- **Stdin JSON** — Claude Code passes `HookInput` as JSON on stdin

## Out of Scope (Phase 5+)

- Write/Edit content analysis (Phase 5)
- PowerShell-specific parsing (Phase 6)
- Custom user rules (Phase 6)
- Interactive confirmation prompts (not possible in hook architecture)
