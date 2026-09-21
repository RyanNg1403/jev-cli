# Jev CLI (`jev`)

Fast Unix semantic reflex utility powered by [TypeSafe's System One model (Jev)](https://typesafe.ai). 

Functions as a semantic `grep` and `test` primitive for shell pipelines and autonomous AI agents—enabling **progressive discovery** and **fast semantic triage** on disk and pipes without polluting the LLM context window.

```text
Local Files / Pipes ========> Jev Reflex (~700ms) ========> Typed Answer (5 tokens)
(Megabytes of raw data)        [Bypasses LLM Context]          (Zero Context Pollution)
```

---

## Quick Install

```bash
# Via npm
npm install -g @typesafe-ai/jev

# Or build native binary with Bun (<10ms startup)
bun run compile && cp ./jev /usr/local/bin/jev
```

Set your API key:
```bash
export TYPESAFE_API_KEY="your-key" # or add to ~/.jev.env
```

---

## Core Commands

| Command | Purpose | Example |
| :--- | :--- | :--- |
| **`jev choice`** | Route to best candidate | `cat error.log \| jev choice -c "db,auth,network" -q` |
| **`jev noul`** | Boolean test / semantic grep | `git diff \| jev noul -i "Modifies database schema?" --threshold 0.8` |
| **`jev score`** | Grade along descriptive rubric | `cat crash.log \| jev score -l "minor,moderate,critical" -q` |
| **`jev eval`** | Multi-question triage in 1 pass | `cat ticket.json \| jev eval --spec ./spec.json --json` |
| **`jev models`** | List available models | `jev models list` |
| **`jev add-skill`** | Register skill in agent registries | `jev add-skill [codex\|claude\|cursor\|all]` |

---

## Common Pipelines

```bash
# 1. Semantic grep over streaming logs
cat /var/log/auth.log | jev noul -i "Credential stuffing attempt?" --filter --stream

# 2. Safe file inspection with null delimiters (-z) for xargs -0
find ./docs -name "*.md" -print0 | xargs -0 jev noul -i "Contains API keys?" --filter -z | xargs -0 chmod 600

# 3. Shell conditional gating (exit 0 on True, 1 on False)
if jev noul -i "Customer threatens churn?" customer_message.txt; then
  ./alert-support.sh customer_message.txt
fi

# 4. Instant agent integration (Antigravity, Codex CLI, Claude Code, Cursor)
jev add-skill
```

---

## Exit Codes

| Code | Meaning |
| :--- | :--- |
| `0` | **Success / Condition Met** ($P \ge \text{threshold}$) |
| `1` | **Condition Unmet** ($P < \text{threshold}$ or zero filter matches) |
| `2` | **CLI Validation Error** (missing required flag, invalid JSON) |
| `3` | **API / Network Failure** |

---

## License

MIT © [Phat Nguyen](https://github.com/RyanNg1403)
