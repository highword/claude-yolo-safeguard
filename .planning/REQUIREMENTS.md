# Requirements: claude-yolo-safeguard

**Defined:** 2026-05-18
**Core Value:** Users can enable YOLO mode and work at full speed, knowing destructive operations will be caught and stopped before execution.

## v1 Requirements

### Shell Command Interception

- [ ] **SHELL-01**: Tool blocks rm -rf targeting paths outside cwd, root (/), and home (~)
- [ ] **SHELL-02**: Tool blocks git reset --hard, git clean -f, git push --force (without --force-with-lease)
- [ ] **SHELL-03**: Tool blocks git branch -D, git stash drop, git stash clear
- [ ] **SHELL-04**: Tool blocks DROP DATABASE, DROP TABLE, TRUNCATE TABLE commands
- [ ] **SHELL-05**: Tool detects dangerous commands nested in shell wrappers (bash -c, sh -c) up to 10 layers deep
- [ ] **SHELL-06**: Tool detects dangerous commands in interpreter one-liners (python -c, node -e, ruby -e)
- [ ] **SHELL-07**: Tool correctly splits compound commands (&&, ||, |, ;) and analyzes each segment
- [ ] **SHELL-08**: Tool distinguishes safe variants (git checkout -b, git branch -d, rm file.tmp) from dangerous ones
- [ ] **SHELL-09**: Tool does NOT false-positive on string literals mentioning commands (e.g., gh issue --body "git reset")

### Response System

- [ ] **RESP-01**: Tool classifies each detection as CRITICAL, HIGH, MEDIUM, or LOW severity
- [ ] **RESP-02**: CRITICAL detections hard-block execution (always, no session bypass)
- [ ] **RESP-03**: HIGH detections block with explanation and safe alternative suggestion
- [ ] **RESP-04**: MEDIUM detections warn but do not block execution
- [ ] **RESP-05**: LOW detections are silently logged only
- [ ] **RESP-06**: Block messages clearly state why blocked and suggest a safe alternative command
- [ ] **RESP-07**: All decisions (allow/block/warn) are recorded in JSONL audit log

### Code Content Security

- [ ] **CODE-01**: Tool detects hardcoded API keys, tokens, and passwords in written code (pattern + entropy analysis)
- [ ] **CODE-02**: Tool detects SQL injection patterns (string concatenation in SQL queries)
- [ ] **CODE-03**: Tool detects XSS patterns (innerHTML assignment, dangerouslySetInnerHTML, document.write)
- [ ] **CODE-04**: Tool detects dangerous function usage (eval, new Function, os.system, subprocess with shell=True, child_process.exec)
- [ ] **CODE-05**: Tool detects insecure cryptography (MD5/SHA1 for password hashing, ECB mode)
- [ ] **CODE-06**: Tool hooks Write and Edit tools (not just Bash) via PreToolUse

### Installation & Configuration

- [ ] **INST-01**: User can install with single command: npx claude-yolo-safeguard init
- [ ] **INST-02**: Installation auto-registers hooks in Claude Code settings without manual config
- [ ] **INST-03**: Tool works immediately after install with zero configuration (sensible defaults)
- [ ] **INST-04**: User can add custom blocking rules via .safeguard.json in project root
- [ ] **INST-05**: User can define allow-list exceptions for specific commands/patterns
- [ ] **INST-06**: User can configure severity-to-action mapping (customize what blocks vs warns)

### Cross-Platform

- [ ] **PLAT-01**: Tool works on macOS with POSIX shell commands
- [ ] **PLAT-02**: Tool works on Linux with POSIX shell commands
- [ ] **PLAT-03**: Tool works on Windows with PowerShell commands (native syntax understanding)
- [ ] **PLAT-04**: Tool normalizes file paths correctly across platforms (forward/back slash, drive letters, case sensitivity)

## v2 Requirements

### Multi-Platform Expansion

- **MULTI-01**: Tool supports Gemini CLI (BeforeTool hook adapter)
- **MULTI-02**: Tool supports Codex CLI (PreToolUse hook adapter)
- **MULTI-03**: Tool supports Cursor (beforeShellExecution hook adapter)
- **MULTI-04**: Tool supports Windsurf (pre_run_command hook adapter)

### Advanced Detection

- **ADV-01**: Tool correlates Write→Execute sequences (detect writing malicious script then running it)
- **ADV-02**: Tool detects base64-encoded dangerous commands
- **ADV-03**: Tool detects network data exfiltration patterns (curl/wget to suspicious targets)
- **ADV-04**: Tool provides security report generation (summary of all interceptions)

### Distribution

- **DIST-01**: Tool available on Claude Code Plugin Marketplace
- **DIST-02**: Tool supports auto-update mechanism

## Out of Scope

| Feature | Reason |
|---------|--------|
| LLM-based contextual judgment | Adds latency + API dependency; deterministic rules are faster and more reliable for v1 |
| Container/sandbox isolation | Different philosophy — we're lightweight interception, not isolation |
| GUI dashboard | CLI-first tool; web UI adds complexity without core value |
| Network monitoring (v1) | High complexity, deferred to v2 |
| Real-time file system watching | Hook-based interception is sufficient; no need for background daemon |
| Non-coding-AI use cases | Focused exclusively on AI coding assistants |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | TBD | Pending |
| SHELL-02 | TBD | Pending |
| SHELL-03 | TBD | Pending |
| SHELL-04 | TBD | Pending |
| SHELL-05 | TBD | Pending |
| SHELL-06 | TBD | Pending |
| SHELL-07 | TBD | Pending |
| SHELL-08 | TBD | Pending |
| SHELL-09 | TBD | Pending |
| RESP-01 | TBD | Pending |
| RESP-02 | TBD | Pending |
| RESP-03 | TBD | Pending |
| RESP-04 | TBD | Pending |
| RESP-05 | TBD | Pending |
| RESP-06 | TBD | Pending |
| RESP-07 | TBD | Pending |
| CODE-01 | TBD | Pending |
| CODE-02 | TBD | Pending |
| CODE-03 | TBD | Pending |
| CODE-04 | TBD | Pending |
| CODE-05 | TBD | Pending |
| CODE-06 | TBD | Pending |
| INST-01 | TBD | Pending |
| INST-02 | TBD | Pending |
| INST-03 | TBD | Pending |
| INST-04 | TBD | Pending |
| INST-05 | TBD | Pending |
| INST-06 | TBD | Pending |
| PLAT-01 | TBD | Pending |
| PLAT-02 | TBD | Pending |
| PLAT-03 | TBD | Pending |
| PLAT-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 0
- Unmapped: 32 ⚠️

---
*Requirements defined: 2026-05-18*
*Last updated: 2026-05-18 after initial definition*
