# claude-yolo-safeguard

## What This Is

A universal, lightweight AI agent safety guardrail that enables developers to confidently use YOLO/full-auto modes. It transparently intercepts dangerous operations from Claude Code (and future AI tools), providing graduated response (block/confirm/warn/log) with zero configuration required.

**Tagline:** YOLO without fear. Safe for efficiency.

## Core Value

Users can enable YOLO mode and work at full speed, knowing that truly destructive operations will be caught and stopped before they execute — without any setup burden.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Shell command interception with semantic analysis
- [ ] Graduated response system (CRITICAL/HIGH/MEDIUM/LOW)
- [ ] Code content security detection (XSS, SQL injection, hardcoded secrets, eval, unsafe crypto)
- [ ] Full tool coverage (Bash + Write + Edit hooks)
- [ ] Zero-config installation (one command, auto-registers hooks)
- [ ] Custom rule configuration (user-defined rules via JSON)
- [ ] Allow-list/bypass mechanism for legitimate operations
- [ ] Windows native support (PowerShell/cmd syntax understanding)
- [ ] Audit logging (all interceptions recorded)
- [ ] Smart false-positive reduction (context-aware, not just pattern matching)

### Out of Scope

- Network security monitoring (data exfiltration detection) — complexity too high for v1, defer to v2+
- LLM-based contextual judgment — adds latency and API dependency, defer to v2+
- Non-Claude platforms (Gemini, Codex, Cursor, Windsurf) — architecture supports it, but MVP is Claude Code only
- GUI/dashboard for viewing logs — CLI-only for v1

## Context

**Market landscape:**
- Primary competitor: `claude-code-safety-net` (1,342 stars) — shell command interception only, no code content security, no graduated response, high false positives
- Other: `shellfirm` (906 stars), `hol-guard` (319 stars), `sh-guard` (18 stars)
- Gap: No project combines shell command safety + code content security + graduated response + zero-config

**Claude Code's built-in security-guidance plugin:**
- Only checks Write/Edit for 9 fixed patterns (eval, innerHTML, pickle, etc.)
- One-time warning per session (second attempt passes through)
- Does NOT monitor Bash tool at all
- Cannot be extended by users

**Target users:**
1. Developers already using YOLO mode but feeling uneasy
2. Developers who want YOLO efficiency but are afraid to enable it

**Release strategy:**
- v0.1: Shell command interception + graduated strategy (match and exceed safety-net)
- v0.2: Code content security detection (Write/Edit hook coverage)

## Constraints

- **Performance**: Core analysis must complete in <50ms — no perceptible latency
- **Dependencies**: ≤3 runtime dependencies — minimize attack surface and install size
- **Bundle size**: Single-file bundle target ~50-100KB
- **Tech stack**: TypeScript + Bun (build/test/bundle) + Biome (lint)
- **Distribution**: npm package with `npx claude-yolo-safeguard init` one-command setup; Plugin Marketplace later
- **Compatibility**: Must work on Windows (PowerShell/cmd), macOS, Linux
- **Zero-config**: Must provide useful protection immediately after install with no configuration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over Rust/Go | Ecosystem alignment with Claude Code, faster iteration, lower contributor barrier | — Pending |
| Plugin/Hook over MCP | Security guardrails must be mandatory (intercept all ops), not optional (AI decides to call) | — Pending |
| Graduated response over hard-block-all | Prevents user fatigue and uninstalls; CRITICAL = block, MEDIUM = warn only | — Pending |
| Bun as build tool | Faster than tsc+node, built-in bundler for single-file output, built-in test runner | — Pending |
| No Claude prefix in package name | Architecture supports multi-platform expansion; brand as universal tool | — Pending |
| v0.1 shell-first, v0.2 code-content | Ship faster, get feedback, iterate; shell interception is table stakes | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-18 after initialization*
