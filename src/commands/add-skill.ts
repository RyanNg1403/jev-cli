import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface AddSkillOptions {
  dir?: string;
  global?: boolean;
  force?: boolean;
  quiet?: boolean;
}

export const EMBEDDED_SKILL_MD = `---
name: jev-cli
description: >
  High-performance Unix semantic reflex utility powered by TypeSafe's Jev (System One model).
  Use when an agent or bash script needs fast semantic triage, classification, boolean filtering,
  rubric scoring, or orthogonal evaluation on local files, git diffs, incident logs, or stdin
  streams without polluting the primary agent's context window. Enables progressive discovery,
  semantic grep pipelines, and deterministic gating using exit codes and calibrated probabilities.
---

# Jev CLI: Semantic Reflex Utility for Agents & Pipelines

\`jev\` is a lightweight, high-performance Unix command-line interface for **TypeSafe's System One (Jev)** model. It serves as a semantic \`grep\` and \`test\` primitive designed for local scripts, bash pipelines, and autonomous agent execution environments.

Instead of stuffing thousands of lines of raw text, codebases, or incident logs into a frontier LLM's context window, agents use \`jev\` to inspect, filter, score, and route data directly on disk or across Unix pipes—returning typed decisions with calibrated probabilities.

---

## 1. Architectural Philosophy: Zero Context Pollution

\`\`\`text
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
\`\`\`

* **Raw data bypasses LLM context**: Megabytes stream directly from disk or pipes to Jev without consuming LLM context tokens or incurring multi-second prompt processing latency.
* **Calibrated probabilities**: Returns calibrated probability distributions for programmatic gating.
* **Deterministic POSIX exit codes**: Integrates natively into bash control flow (\`0\` = matched/passed, \`1\` = condition unmet, \`2\` = argument error, \`3\` = API/network error).

---

## 2. At a Glance: When to Use Jev

| Command | Purpose | Input Source | Primary Output |
| :--- | :--- | :--- | :--- |
| \`jev choice\` | Select best option from candidate IDs or rubrics | Stdin / files / arg | Winning choice ID (\`-q\`), TSV, or JSON |
| \`jev noul\` | Evaluate boolean condition or semantic grep | Stdin / files / arg | Pass/fail exit code (\`0\`/\`1\`), text (\`--filter\`), or JSON |
| \`jev score\` | Grade along ordered descriptive rubrics | Stdin / files / arg | Winning label (\`-q\`), numeric score (\`--value\`), or JSON |
| \`jev eval\` | Evaluate multiple orthogonal questions in 1 pass | Stdin / files / arg | Structured JSON dictionary of answers |
| \`jev models\` | List available models or set CLI default | API | Table or JSON |
| \`jev auth\` | Manage stored credentials (set-key, status, logout) | Config | Status string or JSON |
| \`jev add-skill\` | Install skill into agent registries | Local / global | Skill path in agent directories |

---

## 3. Core CLI Commands

### \`jev choice\`
Selects the single best option from candidate keys or evaluates content against descriptive candidate rubrics.

#### Key Flags
* \`-c, --choices <csv>\`: Comma-separated candidate IDs (e.g. \`db,auth,network\`).
* \`--criteria <json|@file>\`: Rubric mapping candidate keys to detailed descriptions.
* \`-i, --instruction <text|json|@file>\` *(Required)*: Decision criteria or question.
* \`-q, --quiet\`: Emits only the winning candidate ID.
* \`--tsv\`: Emits tab-separated \`<winner>\\t<probability>\\t<confidence>\`.
* \`--json\`: Emits complete JSON with probability distribution and confidence.
* \`--threshold <float>\`: Minimum confidence (0.0 to 1.0). Exits \`1\` if below threshold.
* \`--stream\`: Streams \`stdin\` line-by-line concurrently with bounded backpressure.
* \`-z, --null\`: Delimits records with ASCII \`\\0\`.

#### Examples
\`\`\`bash
# Fast routing into a variable
SUBSYSTEM=$(cat incident.log | jev choice -c "database,network,auth" -i "Responsible subsystem" -q)
\`\`\`

---

### \`jev noul\`
Evaluates a boolean condition (Yes/No) and returns calibrated probability $P(\\text{yes})$. Also functions as a **semantic grep** via \`--filter\`.

#### Key Flags
* \`-i, --instruction <text|json|@file>\` *(Required)*: Condition to evaluate.
* \`--criteria <json|@file>\`: Explicit definitions for \`true\` and \`false\`.
* \`--filter\`: **Semantic grep mode**. Passes through matching lines or file paths to \`stdout\` only if $P(\\text{yes}) \\ge \\text{threshold}$; discards non-matches.
* \`--threshold <float>\`: Cutoff probability (default: \`0.5\`). Exits \`0\` if $\\ge$ threshold, \`1\` if below.
* \`--stream\`: Evaluates \`stdin\` line-by-line concurrently over persistent connections.
* \`-z, --null\`: Uses ASCII \`\\0\` delimiters.
* \`-q, --quiet\`: Emits only \`true\` or \`false\`.
* \`--prob\`: Emits only raw numeric probability (e.g. \`0.942\`).

---

### \`jev score\`
Evaluates content along an ordered descriptive scale or rubric (at least 2 levels).

#### Key Flags
* \`-l, --levels <csv|json|@file>\` *(Required)*: Ordered level names or descriptive rubrics.
* \`-i, --instruction <text|json|@file>\` *(Required)*: Evaluation criteria or rubric.
* \`-q, --quiet\`: Emits the winning descriptive label.
* \`--value\`: Emits the numeric expected score.
* \`--json\`: Emits complete distribution, legend, and confidence.

---

### \`jev eval\`
Executes **multiple orthogonal questions** over a single state in a **single parallel API roundtrip**.

#### Key Flags
* \`-s, --spec <json|@file>\` *(Required)*: Spec defining questions and their types (\`choice\`, \`noul\`, \`score\`).
* \`--json\`: Emits dictionary of typed answers and probability distributions (default: \`true\`).

---

### \`jev add-skill\`
Registers the Jev CLI skill into agent registries (Antigravity, Codex, Claude Code, Cursor, or custom directories).

\`\`\`bash
# Install to project agent registry (defaults to .agents/skills/jev-cli/SKILL.md)
jev add-skill

# Target specific agent platforms
jev add-skill codex
jev add-skill claude
jev add-skill cursor
jev add-skill all

# Global installation to user home (~/...)
jev add-skill --global

# Custom target directory
jev add-skill --dir ./company-skills
\`\`\`

---

## 4. Prominent Workflows

### Workflow 1: Progressive Codebase Discovery ("Needle in a Haystack")
\`\`\`bash
TARGET_DIR=$(ls -d */ | jev choice \\
  -c "auth-service,payment-service,storage-service,gateway" \\
  -i "Which service handles presigned upload URL generation?" -q)

TARGET_FILE=$(find "$TARGET_DIR" -type f -name "*.ts" | \\
  jev choice \\
    -i "Which file implements presigned S3 upload authorization?" \\
    -c "$(find "$TARGET_DIR" -type f -name "*.ts" | paste -sd, -)" -q)

cat "$TARGET_FILE"
\`\`\`

### Workflow 2: Safe Multi-File Content Filtering with \`-z\` & \`xargs\`
\`\`\`bash
find ./docs -name "*.md" -print0 | \\
  xargs -0 jev noul \\
    -i "Does this document content contain unencrypted API keys, secrets, or passwords?" \\
    --filter \\
    -z | \\
  xargs -0 chmod 600
\`\`\`

### Workflow 3: Multi-Dimensional PR & Git Diff Gating
\`\`\`bash
ANALYSIS=$(git diff main...HEAD | jev eval --spec '{
  "has_schema_changes": { "type": "noul", "instructions": "Modifies database schema?" },
  "has_security_concerns": { "type": "noul", "instructions": "Plaintext secrets or relaxed auth?" },
  "risk_score": { "type": "score", "instructions": "Deployment risk", "criteria": ["Low", "Moderate", "High"] }
}' --json)

if jq -e '
  (.has_schema_changes.noul >= 0.80) or
  (.has_security_concerns.noul >= 0.80) or
  (.risk_score.score >= 1.5)
' >/dev/null <<<"$ANALYSIS"; then
  echo "PR policy gate failed!" >&2
  exit 1
fi
\`\`\`

### Workflow 4: Resilient Shell Script Branching
\`\`\`bash
if jev noul -i "Does this feedback threaten churn?" --threshold 0.75 "$FEEDBACK_FILE" >/dev/null; then
  ./notify-escalation.sh "$FEEDBACK_FILE"
else
  rc=$?
  case "$rc" in
    1) ./log-feedback.sh "$FEEDBACK_FILE" ;;
    2) echo "Argument error" >&2; exit 2 ;;
    3) echo "API error" >&2; exit 3 ;;
  esac
fi
\`\`\`

---

## 5. Unix Pipeline Quick Reference

### Exit Status Codes
- **\`0\`**: Condition met / successful match ($P \\ge \\text{threshold}$).
- **\`1\`**: Condition unmet ($P < \\text{threshold}$); or with \`--filter\`, no records matched.
- **\`2\`**: CLI argument / validation error (missing required flag, bad JSON spec).
- **\`3\`**: Upstream API, authentication, rate-limit, timeout, or network failure.
`;

export function resolveSkillTargets(
  agent: string | undefined,
  options: AddSkillOptions
): string[] {
  const home = os.homedir();
  const cwd = process.cwd();

  // If custom dir is provided
  if (options.dir) {
    let resolved = options.dir;
    if (resolved.startsWith("~")) {
      resolved = path.join(home, resolved.slice(1));
    }
    resolved = path.resolve(cwd, resolved);

    if (resolved.endsWith(".md")) {
      return [resolved];
    }
    const base = path.basename(resolved);
    if (base === "jev-cli" || base === "jev") {
      return [path.join(resolved, "SKILL.md")];
    }
    return [path.join(resolved, "jev-cli", "SKILL.md")];
  }

  const normalized = agent ? agent.toLowerCase().trim() : "default";

  if (options.global) {
    switch (normalized) {
      case "antigravity":
      case "gemini":
        return [
          path.join(home, ".gemini", "antigravity-cli", "skills", "jev-cli", "SKILL.md"),
          path.join(home, ".agents", "skills", "jev-cli", "SKILL.md"),
        ];
      case "codex":
        return [
          path.join(home, ".codex", "skills", "jev-cli", "SKILL.md"),
          path.join(home, ".agents", "skills", "jev-cli", "SKILL.md"),
        ];
      case "claude":
      case "claude-code":
        return [path.join(home, ".claude", "skills", "jev-cli", "SKILL.md")];
      case "cursor":
        return [path.join(home, ".cursor", "skills", "jev-cli", "SKILL.md")];
      case "all":
        return [
          path.join(home, ".agents", "skills", "jev-cli", "SKILL.md"),
          path.join(home, ".codex", "skills", "jev-cli", "SKILL.md"),
          path.join(home, ".claude", "skills", "jev-cli", "SKILL.md"),
          path.join(home, ".cursor", "skills", "jev-cli", "SKILL.md"),
          path.join(home, ".gemini", "antigravity-cli", "skills", "jev-cli", "SKILL.md"),
        ];
      case "default":
      default:
        return [path.join(home, ".agents", "skills", "jev-cli", "SKILL.md")];
    }
  }

  switch (normalized) {
    case "antigravity":
    case "gemini":
      return [path.join(cwd, ".agents", "skills", "jev-cli", "SKILL.md")];
    case "codex": {
      const targets = [path.join(cwd, ".agents", "skills", "jev-cli", "SKILL.md")];
      if (fs.existsSync(path.join(cwd, ".codex"))) {
        targets.push(path.join(cwd, ".codex", "skills", "jev-cli", "SKILL.md"));
      }
      return targets;
    }
    case "claude":
    case "claude-code":
      return [path.join(cwd, ".claude", "skills", "jev-cli", "SKILL.md")];
    case "cursor":
      return [path.join(cwd, ".cursor", "skills", "jev-cli", "SKILL.md")];
    case "all": {
      const targets = [
        path.join(cwd, ".agents", "skills", "jev-cli", "SKILL.md"),
        path.join(cwd, ".claude", "skills", "jev-cli", "SKILL.md"),
        path.join(cwd, ".cursor", "skills", "jev-cli", "SKILL.md"),
      ];
      if (fs.existsSync(path.join(cwd, ".codex"))) {
        targets.push(path.join(cwd, ".codex", "skills", "jev-cli", "SKILL.md"));
      }
      return targets;
    }
    case "default":
    default: {
      const targets: string[] = [path.join(cwd, ".agents", "skills", "jev-cli", "SKILL.md")];
      if (fs.existsSync(path.join(cwd, ".claude"))) {
        targets.push(path.join(cwd, ".claude", "skills", "jev-cli", "SKILL.md"));
      }
      if (fs.existsSync(path.join(cwd, ".cursor"))) {
        targets.push(path.join(cwd, ".cursor", "skills", "jev-cli", "SKILL.md"));
      }
      if (fs.existsSync(path.join(cwd, ".codex"))) {
        targets.push(path.join(cwd, ".codex", "skills", "jev-cli", "SKILL.md"));
      }
      return targets;
    }
  }
}

export function handleAddSkill(
  agent: string | undefined,
  options: AddSkillOptions
): number {
  try {
    const targets = resolveSkillTargets(agent, options);

    let writtenCount = 0;
    for (const targetPath of targets) {
      if (fs.existsSync(targetPath) && !options.force) {
        if (!options.quiet) {
          process.stdout.write(
            `Skill already exists at ${targetPath} (use --force to overwrite).\n`
          );
        }
        continue;
      }

      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(targetPath, EMBEDDED_SKILL_MD, "utf-8");
      writtenCount++;

      if (options.quiet) {
        process.stdout.write(`${targetPath}\n`);
      } else {
        process.stdout.write(`Installed jev-cli skill to: ${targetPath}\n`);
      }
    }

    if (!options.quiet && writtenCount > 0) {
      process.stdout.write(
        `\nSkill registered successfully! Autonomous agents (Antigravity, Codex, Claude Code, Cursor) can now discover and invoke 'jev' CLI.\n`
      );
    }

    return 0;
  } catch (err: any) {
    process.stderr.write(`Error installing skill: ${err.message}\n`);
    return 2;
  }
}
