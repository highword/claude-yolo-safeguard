# Research Summary

**Project:** claude-yolo-safeguard
**Synthesized:** 2026-05-18
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Key Findings

### Stack
- **TypeScript + Bun** — ecosystem-aligned, single-tool build/test/bundle, npm-native distribution
- **Single .cjs bundle** via Bun.build() (~50-100KB) — no node_modules on user machines
- **Runtime dependency:** shell-quote ^1.8.1 (POSIX parsing); custom lightweight tokenizer for PowerShell
- **Lint:** Biome (100x faster than ESLint, zero config)
- **Hook protocol:** exit 0 = allow, exit 2 = block, JSON stdout for reason

### Features (17 total)
- **v0.1 (7 table stakes):** dangerous command patterns, recursive wrapper detection, graduated response, zero-config install, audit logging, block messages with alternatives, PreToolUse hook integration
- **v0.2 (6 table stakes):** hardcoded secrets detection, SQL injection, XSS, dangerous functions, insecure crypto, Write/Edit hook coverage
- **Differentiators (6):** false-positive reduction, allow-list mechanism, Windows PowerShell native, configurable severity, security reports, custom rule sharing
- **Critical path:** Pattern Engine → Wrapper Detection → Graduated Response → Hook Integration

### Architecture
- **Synchronous pipeline** — no async, fresh process per invocation, <50ms target
- **Platform adapter pattern** — thin adapters (~100-200 LOC) normalize hook protocols into common `HookInput` interface
- **Fail-open default** — if safeguard errors, operation proceeds (prevents becoming a blocker)
- **3-layer analysis:** Router → Analyzer Pipeline (command + content) → Severity Classifier
- **Config cascade:** project-level (.safeguard.json) > user-level (~/.claude-yolo-safeguard/config.json) > defaults

### Pitfalls (Top 5)
1. **False positives** (CRITICAL) — context-aware parsing from day 1, distinguish execution vs text
2. **Performance** (CRITICAL) — single-file bundle, direct node invocation, never npx in hot path
3. **"already_warned" bypass** (HIGH) — CRITICAL rules always block, no session weakening
4. **Windows path normalization** (HIGH) — normalize before comparison, use path.resolve
5. **User fatigue** (HIGH) — only CRITICAL/HIGH actually interrupt; MEDIUM/LOW are silent

---

## Competitive Position

| Dimension | safety-net | shellfirm | security-guidance | **yolo-safeguard** |
|-----------|-----------|-----------|-------------------|-------------------|
| Shell commands | ✓ semantic | ✓ regex | ✗ | ✓ semantic |
| Code content | ✗ | ✗ | ✓ partial (9 patterns) | ✓ comprehensive |
| Graduated response | ✗ (block only) | ✗ | ✗ (warn once) | ✓ 4-level |
| Allow-list | ✗ | ✗ | ✗ | ✓ |
| Windows native | partial | ✗ | ✗ | ✓ |
| Zero-config | ✓ | ✗ | ✓ | ✓ |
| False-positive handling | weak | weak | N/A | strong (context-aware) |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| False positives kill adoption | HIGH | CRITICAL | Context-aware parsing architecture from v0.1 |
| PowerShell parser complexity | MEDIUM | HIGH | Start with common patterns, expand iteratively |
| safety-net adds code content security first | MEDIUM | MEDIUM | Ship v0.1 fast, v0.2 within 2 weeks |
| Bundle size exceeds target | LOW | LOW | tree-shaking + minimal deps keep it small |

---

## Implementation Timeline (Estimate)

| Phase | Scope | Effort |
|-------|-------|--------|
| v0.1 | Shell interception + graduated response + zero-config | 2-3 weeks |
| v0.2 | Code content security (Write/Edit hooks) | 3-4 weeks |
| v1.0 | Polish + Plugin Marketplace + Windows hardening | 2-3 weeks |

---

## Open Questions

- Claude Code hook timeout behavior: fail-open or fail-closed on slow hooks?
- Biome 2.x stability vs staying on 1.9.x
- PowerShell parser: regex-based sufficient or needs proper tokenizer?
- Plugin Marketplace submission requirements and timeline

---
*Research synthesized: 2026-05-18*
