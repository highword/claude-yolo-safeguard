# Roadmap: claude-yolo-safeguard

**Created:** 2026-05-18
**Phases:** 6
**Requirements:** 32 mapped
**Granularity:** Standard

## Phases

- [ ] **Phase 1: Foundation & Core Types** - Project scaffold, shared types, config system, built-in rule definitions
- [ ] **Phase 2: Shell Command Analysis** - POSIX parser, command segmentation, rule matching, false-positive reduction
- [ ] **Phase 3: Response & Decision Engine** - Severity classification, graduated actions, audit logging, message formatting
- [ ] **Phase 4: Hook Integration & Installation** - Claude Code adapter, entry point, CLI installer, zero-config setup
- [ ] **Phase 5: Code Content Security** - Content analyzer, Write/Edit hook routing, secret/XSS/SQLi/eval/crypto detection
- [ ] **Phase 6: Windows Native & Advanced Configuration** - PowerShell parser, path normalization, custom rules, allow-list

## Phase Details

### Phase 1: Foundation & Core Types

**Goal:** Establish the project scaffold with all shared interfaces, configuration system, and rule definitions so subsequent phases can build on stable contracts.
**Depends on:** --
**Requirements:** RESP-01, INST-03
**Plans:** TBD

#### Success Criteria

1. Project builds successfully with Bun (tsconfig, biome, bunfig configured)
2. All shared type interfaces (HookInput, Rule, Decision, Config, Severity) are defined and importable
3. Config loader merges defaults -> user-level -> project-level with correct precedence
4. Built-in rule definitions (shell + content) exist as data with id, severity, pattern, and suggestion
5. Default severity-to-action mapping (CRITICAL=block, HIGH=block, MEDIUM=warn, LOW=log) is configured

---

### Phase 2: Shell Command Analysis

**Goal:** Users' dangerous shell commands (rm -rf, DROP DATABASE, git force-push) are detected and classified before execution.
**Depends on:** Phase 1
**Requirements:** SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, SHELL-06, SHELL-07, SHELL-08, SHELL-09, PLAT-01, PLAT-02
**Plans:** TBD

#### Success Criteria

1. `rm -rf /` and `rm -rf ~` are detected as CRITICAL; `rm file.tmp` is NOT flagged
2. `git push --force main` is detected; `git push --force-with-lease` and `git checkout -b new-branch` are NOT flagged
3. `bash -c "rm -rf /"` nested up to 10 layers deep is detected; `echo "rm -rf /"` is NOT flagged
4. `python -c "import os; os.system('rm -rf /')"` is detected as dangerous
5. Compound commands (`cmd1 && cmd2 | cmd3`) are split and each segment analyzed independently

---

### Phase 3: Response & Decision Engine

**Goal:** Every detection produces the correct graduated response (block/warn/log) with clear explanations, safe alternatives, and an audit trail.
**Depends on:** Phase 1
**Requirements:** RESP-02, RESP-03, RESP-04, RESP-05, RESP-06, RESP-07
**Plans:** TBD

#### Success Criteria

1. CRITICAL detections produce a hard block with exit code 2 and cannot be session-bypassed
2. HIGH detections produce a block with an explanation message and a safe alternative command suggestion
3. MEDIUM detections allow execution but emit a visible warning to stderr
4. LOW detections pass silently with no user-visible output
5. Every decision (allow, block, or warn) is appended as a JSONL record to the audit log file

---

### Phase 4: Hook Integration & Installation

**Goal:** Users can install with a single command and immediately have shell commands protected with zero manual configuration.
**Depends on:** Phase 2, Phase 3
**Requirements:** INST-01, INST-02
**Plans:** TBD

#### Success Criteria

1. `npx claude-yolo-safeguard init` completes successfully and registers the hook in Claude Code settings
2. After installation, Claude Code's Bash tool invocations are intercepted without any manual settings.json edits
3. The hook responds within 50ms for typical commands (no perceptible latency)
4. The bundled output is a single .cjs file under 100KB

---

### Phase 5: Code Content Security

**Goal:** Dangerous code patterns (hardcoded secrets, XSS, SQL injection, eval, insecure crypto) written via Write/Edit tools are detected and blocked.
**Depends on:** Phase 3, Phase 4
**Requirements:** CODE-01, CODE-02, CODE-03, CODE-04, CODE-05, CODE-06
**Plans:** TBD

#### Success Criteria

1. A Write operation containing `const API_KEY = 'sk-live-abc123'` is detected and blocked as a hardcoded secret
2. SQL string concatenation patterns (`"SELECT * FROM users WHERE id=" + userId`) trigger a HIGH detection
3. `innerHTML = userInput` and `dangerouslySetInnerHTML` assignments are detected as XSS risks
4. `eval()`, `new Function()`, `subprocess.call(cmd, shell=True)` are flagged as dangerous function usage
5. Write and Edit tool invocations are routed through the content analyzer (not just Bash)

---

### Phase 6: Windows Native & Advanced Configuration

**Goal:** Windows users get native PowerShell/cmd protection, and all users can customize rules, allow-lists, and severity mappings.
**Depends on:** Phase 2, Phase 4
**Requirements:** PLAT-03, PLAT-04, INST-04, INST-05, INST-06
**Plans:** TBD

#### Success Criteria

1. PowerShell-specific dangerous commands (Remove-Item -Recurse -Force C:\) are detected using native syntax understanding
2. File paths are normalized correctly across platforms (forward/back slashes, drive letters, case sensitivity)
3. User can add custom blocking rules in `.safeguard.json` and they are evaluated alongside built-in rules
4. User can define allow-list entries that suppress specific rules for specific commands/paths
5. User can override the default severity-to-action mapping (e.g., make MEDIUM also block)

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation & Core Types | 0/? | Not started | -- |
| 2. Shell Command Analysis | 0/? | Not started | -- |
| 3. Response & Decision Engine | 0/? | Not started | -- |
| 4. Hook Integration & Installation | 0/? | Not started | -- |
| 5. Code Content Security | 0/? | Not started | -- |
| 6. Windows Native & Advanced Configuration | 0/? | Not started | -- |

## Release Mapping

| Release | Phases | Scope |
|---------|--------|-------|
| v0.1 | 1, 2, 3, 4 | Shell interception + graduated response + zero-config install |
| v0.2 | 5, 6 | Code content security + Windows native + advanced config |

---
*Roadmap created: 2026-05-18*
