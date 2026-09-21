# Jev CLI

> High-performance Unix semantic reflex utility powered by TypeSafe's System One model (Jev).

`jev` acts as a semantic `grep` and `test` primitive designed for local scripts, bash pipelines, and autonomous agent environments. It enables **progressive discovery** and **fast semantic triage** on disk and across Unix pipes without polluting primary agent context windows.

---

## 1. Zero Context Pollution Philosophy

```text
+-----------------------+  Emits lean bash command:
| Primary Agent Context | -------------------------------------------------+
+-----------------------+  "cat error.log | jev choice --choices '...' -q" |
                                                                            v
+-----------------------+            500 KB Raw Data via Pipe     +-------------------+
|  Local Host / Script  | ======================================> |    Jev Reflex     |
+-----------------------+         [Never touches LLM context]     +-------------------+
                                                                            |
                                     Returns 5 tokens:                      |
                                     "db_timeout" <-------------------------+
                                          |
                                          v
                              +-----------------------+
                              | Primary Agent Context |
                              +-----------------------+
```

* **Raw Data Stays Local**: Megabytes of logs or source files stream directly from disk to Jev via pipes, bypassing the LLM prompt context.
* **Sub-Second Latency**: Fast, focused judgments in ~700ms without multi-second LLM prompt processing overhead.
* **Calibrated Probabilities**: Structured probability distributions and confidence ratings for deterministic gating.
* **POSIX Pipeline Interop**: Strict exit codes (`0` vs `1`), `-z` null delimiters for `xargs -0`, and async generator streaming with backpressure.

---

## 2. Quick Install

### Native Binary (via Bun)
```bash
bun build --compile src/cli.ts --outfile /usr/local/bin/jev
```

### Node / npm
```bash
npm install -g @typesafe-ai/jev
```

### Setup API Key
```bash
export TYPESAFE_API_KEY="your-api-key"
# Or put in ~/.jev.env or project .env
```

---

## 3. Command Reference

### `jev choice`
Selects the single best option from candidate IDs or descriptive rubrics.

```bash
# Route incident directly into a bash variable
SUBSYSTEM=$(cat incident.log | jev choice -c "database,network,auth" -i "Responsible team" -q)

# Evaluate with detailed rubric descriptions and JSON distribution
jev choice \
  --criteria '{
    "database": "Connection pool timeouts, deadlocks, replication lag",
    "network": "DNS failures, packet loss, TLS handshake timeouts",
    "auth": "JWT expiration, invalid signatures, permission denied"
  }' \
  -i "Identify the primary subsystem responsible for this incident" \
  --json incident.log
```

---

### `jev noul`
Evaluates a boolean condition (Yes/No) with calibrated probability $P(\text{yes})$. Acts as a **semantic grep** via `--filter`.

```bash
# Semantic grep mode: stream lines and filter matching events
cat /var/log/auth.log | \
  jev noul \
    -i "Is this log entry an automated brute-force or credential stuffing attack?" \
    --filter \
    --stream \
    --threshold 0.85

# Shell conditional branching using native exit codes
if git diff | jev noul -i "Does this diff modify database schemas or migrations?" --threshold 0.8; then
  echo "Schema change detected! Triggering migration verification..."
  bun run test:migrations
fi

# Multi-file content filtering with null delimiters for xargs -0
find ./docs -name "*.md" -print0 | \
  xargs -0 jev noul \
    -i "Does this document content expose unencrypted secrets or passwords?" \
    --filter -z | \
  xargs -0 chmod 600
```

---

### `jev score`
Evaluates content along an ordered descriptive scale or rubric (at least 2 levels).

```bash
cat crash.log | jev score \
  --levels '[
    "Cosmetic only; zero user impact",
    "Degraded performance or transient latency",
    "Critical data loss, auth bypass, or complete service downtime"
  ]' \
  -i "Assess the operational severity of this crash" \
  --json
```

* Flags: `-q, --quiet` (winning label), `--value` (numeric score), `--json` (distribution, confidence, legend).

---

### `jev eval`
Executes **multiple orthogonal questions** over a single state in a **single parallel API pass** (~700ms).

```bash
cat support_ticket.json | jev eval --spec '{
  "department": {
    "type": "choice",
    "instructions": "Select responsible team",
    "criteria": {
      "billing": "Invoices, refunds, subscriptions",
      "infra": "Server outages, networking, hardware",
      "auth": "Password resets, 2FA, session errors"
    }
  },
  "urgent": {
    "type": "noul",
    "instructions": "Does this issue report active downtime or security breach?"
  },
  "customer_frustration": {
    "type": "score",
    "instructions": "Assess customer tone",
    "criteria": ["Calm", "Annoyed", "Furious"]
  }
}' --json
```

---

### `jev models`
Inspects available models and configures local CLI defaults.

```bash
# List available models
jev models list

# Pin default model in ~/.config/jev/config.json
jev models set-default jev-latest
```

---

### `jev add-skill`
Registers the Jev agent skill into agent registries (Antigravity, Codex CLI, Claude Code, Cursor, or custom directories).

```bash
# Project-level install (defaults to .agents/skills/jev-cli/SKILL.md)
jev add-skill

# Target specific agent platforms
jev add-skill codex
jev add-skill claude
jev add-skill cursor
jev add-skill all

# Global install across user home directory
jev add-skill --global

# Custom directory
jev add-skill --dir ./internal-tooling/skills
```

---

## 4. Exit Codes

| Code | Meaning | Shell Utility |
| :--- | :--- | :--- |
| `0` | **Condition Met / Success** | Evaluated successfully, and confidence/probability $\ge$ `--threshold`. |
| `1` | **Condition Unmet** | Evaluated successfully, but fell below `--threshold` (or zero matches with `--filter`). |
| `2` | **CLI Argument Error** | Missing required flags, invalid JSON spec, or bad arguments. |
| `3` | **API / Network Failure** | Connection error, timeout, or rate-limited after retries. |

---

## 5. Development & Testing

```bash
# Install dependencies
bun install

# Typecheck
bun run typecheck

# Build Node bundle
bun run build

# Run unit and integration tests
bun test

# Compile standalone native binary
bun run compile

# Run end-to-end multi-step agent benchmark suite
./scripts/run-real-benchmarks.sh
```

---

## License

MIT © [Phat Nguyen](https://github.com/RyanNg1403)
