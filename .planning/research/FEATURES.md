# Feature Landscape

**Domain:** AI Agent Safety Guardrail (Claude Code Plugin)
**Researched:** 2026-05-18
**Competitive context:** claude-code-safety-net (1342 stars), shellfirm (906 stars), Claude Code built-in security-guidance plugin

## Table Stakes - v0.1: Shell Command Interception

Features users expect from day one. Missing any = not viable as safety-net replacement.

| # | Feature | Why Expected | Complexity | Depends On |
|---|---------|--------------|------------|------------|
| TS-1 | Dangerous command pattern matching | Core value prop — rm -rf, DROP DATABASE, git reset --hard, git push --force, git clean -f, git branch -D, git stash clear | Medium | — |
| TS-2 | Recursive shell wrapper detection | bash -c, sh -c, python -c, eval wrapping dangerous commands; safety-net does 10 layers, we must match | Medium | TS-1 |
| TS-3 | Graduated response system | CRITICAL (hard block) / HIGH (confirm) / MEDIUM (warn) / LOW (log); key differentiator vs competitors who only hard-block | Medium | TS-1 |
| TS-4 | Zero-config installation | `npx yolo-safeguard init` auto-registers hooks, sensible defaults; safety-net proves this is expected | Low | — |
| TS-5 | Audit logging | All interceptions recorded with timestamp, command, decision, reason | Low | TS-3 |
| TS-6 | Clear block messages with safe alternatives | User must understand WHY blocked and WHAT to do instead (e.g., "Use git stash pop instead of git stash clear") | Low | TS-1 |
| TS-7 | PreToolUse hook integration (Bash) | Exit code 2 protocol for Claude Code; the actual integration point | Low | TS-3 |

### v0.1 Complexity Assessment

- **Total estimated effort:** 2-3 weeks for solo developer
- **Critical path:** TS-1 (pattern engine) -> TS-2 (wrapper detection) -> TS-3 (graduated response) -> TS-7 (hook integration)
- **Parallelizable:** TS-4, TS-5, TS-6 can be built alongside the critical path

---

## Table Stakes - v0.2: Code Content Security

Features that complete the protection story. Without these, Write/Edit operations are blind spots.

| # | Feature | Why Expected | Complexity | Depends On |
|---|---------|--------------|------------|------------|
| TS-8 | Hardcoded secrets/API keys detection | Entropy analysis + known patterns (AWS keys, GitHub tokens, private keys); prevents credential leaks in committed code | High | TS-3 |
| TS-9 | SQL injection pattern detection | String concatenation in queries, template literal injection; one of the OWASP Top 10 | Medium | TS-3 |
| TS-10 | XSS pattern detection | innerHTML, dangerouslySetInnerHTML, document.write, v-html without sanitization | Medium | TS-3 |
| TS-11 | Dangerous function usage detection | eval(), new Function(), os.system(), subprocess with shell=True, exec(), pickle.loads() | Medium | TS-3 |
| TS-12 | Insecure crypto detection | MD5/SHA1 for passwords, hardcoded IVs, ECB mode, weak key lengths | Low | TS-3 |
| TS-13 | Write/Edit tool hook coverage | PreToolUse hook for Write and Edit tools; analyze file content before it's written | Medium | TS-7 |

### v0.2 Complexity Assessment

- **Total estimated effort:** 3-4 weeks for solo developer
- **Critical path:** TS-13 (Write/Edit hooks) -> TS-8 (secrets, highest complexity) -> TS-9/TS-10/TS-11 (parallelizable)
- **Highest risk:** TS-8 (entropy analysis tuning for false positive rates)

---

## Differentiators

Features that set yolo-safeguard apart from competitors. Not expected, but create competitive moat.

| # | Feature | Value Proposition | Complexity | Depends On | Target |
|---|---------|-------------------|------------|------------|--------|
| DF-1 | Smart false-positive reduction | Context-aware analysis: detecting "rm -rf" in a code comment or string literal vs actual execution; competitors block indiscriminately | High | TS-1, TS-2 | v0.1+ |
| DF-2 | Flexible allow-list/bypass mechanism | Per-project rules (e.g., "allow force push to feature branches"), pattern-based exceptions, temporary bypass with audit trail | Medium | TS-3, TS-5 | v0.2 |
| DF-3 | Windows PowerShell/cmd native syntax | Understand Remove-Item -Recurse -Force, Format-Volume, Stop-Process -Force; competitors only parse POSIX shell | High | TS-1 | v0.1 |
| DF-4 | Configurable severity levels per rule | Users can promote MEDIUM rules to CRITICAL or demote based on project needs; JSON config | Low | TS-3 | v0.2 |
| DF-5 | Security report generation | Summary of all interceptions, patterns detected, risk score; useful for team leads and audits | Medium | TS-5 | v0.3 |
| DF-6 | Multi-platform architecture | Core engine is platform-agnostic; thin adapters for Gemini CLI, Codex, Cursor, Windsurf | Medium | All core | v1.0+ |

### Differentiator Priority

1. **DF-1** (false-positive reduction) — This is THE key differentiator. safety-net's biggest complaint is false positives. Ship in v0.1.
2. **DF-3** (Windows support) — Untapped market. No competitor handles PowerShell natively. Ship in v0.1.
3. **DF-2** (allow-list) — Reduces friction for power users. Ship in v0.2.
4. **DF-4** (configurable severity) — Low effort, high customization value. Ship in v0.2.
5. **DF-5** (reports) — Nice-to-have for teams. Ship in v0.3.
6. **DF-6** (multi-platform) — Long-term moat. Ship in v1.0+.

---

## Anti-Features

Features deliberately NOT built. Each has a clear rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| No LLM calls in hot path | Adds 200-2000ms latency, requires API key, creates external dependency, fails when offline | Pure rule-based analysis with semantic parsing; <50ms budget |
| No container/sandbox approach | Different philosophy entirely — we are lightweight interception, not isolation; containers add setup complexity and break developer workflow | Catch before execution, not isolate during execution |
| No GUI dashboard | CLI-first aligns with target users (terminal-native developers in YOLO mode); GUI adds maintenance burden and framework dependency | CLI commands for log viewing + optional JSON export for third-party tools |
| No network monitoring in v1 | Extremely complex (DNS, HTTP, TCP interception), high false positive rate, requires elevated permissions, blurs scope | Defer to v2+; focus on command and code content first |
| No session-state tracking | Adds complexity, memory usage, potential for stale state bugs; each command should be independently assessable | Stateless per-invocation analysis; audit log provides history |
| No auto-update of rules from remote | Supply chain attack vector; rules should be versioned with the package | Bundled rules, updated via npm package updates only |
| No "learning mode" that weakens over time | Security tools that learn to ignore things become useless; alert fatigue is solved by better detection, not fewer alerts | Better context analysis (DF-1) and explicit allow-lists (DF-2) |

---

## Feature Dependencies

```
Core Engine (TS-1: Pattern Matching)
  |
  +---> TS-2: Recursive Shell Wrapper Detection
  |       |
  |       +---> DF-1: Smart False-Positive Reduction
  |
  +---> DF-3: Windows PowerShell/cmd Support
  |
  +---> TS-3: Graduated Response System
          |
          +---> TS-5: Audit Logging
          |       |
          |       +---> DF-2: Allow-list/Bypass Mechanism
          |       |
          |       +---> DF-5: Security Report Generation
          |
          +---> TS-6: Block Messages with Alternatives
          |
          +---> TS-7: PreToolUse Hook (Bash)
          |       |
          |       +---> TS-13: Write/Edit Hook Coverage
          |               |
          |               +---> TS-8: Secrets Detection
          |               +---> TS-9: SQL Injection Detection
          |               +---> TS-10: XSS Detection
          |               +---> TS-11: Dangerous Functions
          |               +---> TS-12: Insecure Crypto
          |
          +---> DF-4: Configurable Severity per Rule

TS-4: Zero-config Installation (independent, parallelizable)
```

---

## MVP Recommendation

### v0.1 MVP (Shell Safety — "Match and Exceed safety-net")

**Must ship:**
1. TS-1: Dangerous command pattern matching (core engine)
2. TS-2: Recursive shell wrapper detection (10+ layers)
3. TS-3: Graduated response system (all 4 levels)
4. TS-4: Zero-config installation
5. TS-5: Audit logging
6. TS-6: Clear block messages with safe alternatives
7. TS-7: PreToolUse Bash hook integration

**Ship with (key differentiators for v0.1):**
8. DF-1: Smart false-positive reduction (context-aware)
9. DF-3: Windows PowerShell/cmd native support

**Success criteria:**
- Catches all dangerous commands that safety-net catches
- Produces fewer false positives than safety-net
- Works on Windows without degraded experience
- Installs in <30 seconds with zero configuration
- Core analysis <50ms per invocation

### v0.2 (Code Content Security — "Complete the Story")

**Ship:**
1. TS-8: Hardcoded secrets/API keys detection
2. TS-9: SQL injection patterns
3. TS-10: XSS patterns
4. TS-11: Dangerous function usage
5. TS-12: Insecure crypto
6. TS-13: Write/Edit hook coverage
7. DF-2: Allow-list/bypass mechanism
8. DF-4: Configurable severity levels

### Defer

- DF-5 (Security reports): v0.3 — Nice-to-have, not critical for adoption
- DF-6 (Multi-platform): v1.0+ — Only after Claude Code MVP is proven stable
- Network monitoring: v2+ — Fundamentally different detection domain

---

## Competitive Feature Matrix

| Feature | yolo-safeguard (planned) | safety-net | shellfirm | Claude built-in |
|---------|--------------------------|------------|-----------|-----------------|
| Shell command interception | v0.1 | YES | YES | NO |
| Recursive wrapper detection | v0.1 (10+ layers) | YES (10 layers) | NO | NO |
| Graduated response | v0.1 (4 levels) | NO (block only) | NO (block only) | Warn once |
| Code content security | v0.2 (6 categories) | NO | NO | 9 fixed patterns |
| Write/Edit hook | v0.2 | NO | NO | YES |
| Windows native | v0.1 | Weak (POSIX only) | NO | N/A |
| False-positive reduction | v0.1 (context-aware) | NO | NO | NO |
| Allow-list/bypass | v0.2 | NO | NO | NO |
| Zero-config | v0.1 | YES | YES | Built-in |
| Audit logging | v0.1 | NO | NO | NO |
| Configurable rules | v0.2 | NO | Basic | NO |
| Multi-platform | v1.0+ | YES (5 platforms) | N/A | Claude only |
| LLM-based analysis | NEVER (by design) | NO | NO | NO |

---

## Sources

- claude-code-safety-net repository analysis (GitHub, 1342 stars)
- shellfirm repository analysis (GitHub, 906 stars)
- Claude Code security-guidance plugin source inspection
- Claude Code hook protocol documentation (PreToolUse, exit code 2)
- Project exploration notes (.planning/notes/exploration-yolo-safeguard.md)
