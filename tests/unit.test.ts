import { describe, it, expect } from "bun:test";
import {
  resolveChoices,
  resolveLevels,
  resolveCriteria,
  resolveInstruction,
  parseJsonOrString,
} from "../src/utils/input";
import { formatChoiceOutput, formatNoulOutput, formatScoreOutput } from "../src/utils/format";
import { normalizeSpecQuestions } from "../src/commands/eval";
import { processConcurrentOrdered } from "../src/utils/stream";
import { resolveSkillTargets, handleAddSkill } from "../src/commands/add-skill";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Input Parsers", () => {
  it("resolves comma-separated choices", () => {
    const res = resolveChoices("auth, billing, infra");
    expect(res).toEqual(["auth", "billing", "infra"]);
  });

  it("resolves JSON array choices", () => {
    const res = resolveChoices('["auth", "billing", "infra"]');
    expect(res).toEqual(["auth", "billing", "infra"]);
  });

  it("resolves JSON criteria map", () => {
    const res = resolveCriteria('{"db": "database error", "auth": "token error"}');
    expect(res).toEqual({ db: "database error", auth: "token error" });
  });

  it("resolves structured JSON instructions", () => {
    const res = resolveInstruction('{"question": "Is valid?", "context": {"id": 123}}');
    expect(res).toEqual({ question: "Is valid?", context: { id: 123 } });
  });

  it("resolves plain string instructions", () => {
    const res = resolveInstruction("Is valid?");
    expect(res).toBe("Is valid?");
  });
});

describe("Output Formatters", () => {
  it("formats choice quiet output", () => {
    const answer = { choice: "database", confidence: 0.9, probabilities: { database: 0.9 } };
    const out = formatChoiceOutput(answer, { quiet: true });
    expect(out).toBe("database\n");
  });

  it("formats choice TSV output", () => {
    const answer = { choice: "database", confidence: 0.9, probabilities: { database: 0.9 } };
    const out = formatChoiceOutput(answer, { tsv: true });
    expect(out).toBe("database\t0.9\t0.9\n");
  });

  it("formats noul filter output", () => {
    const passing = { noul: 0.95 };
    const resPassing = formatNoulOutput(passing, { filter: true, originalInput: "Sensitive Data", threshold: 0.8 });
    expect(resPassing.passed).toBe(true);
    expect(resPassing.text).toBe("Sensitive Data\n");

    const failing = { noul: 0.2 };
    const resFailing = formatNoulOutput(failing, { filter: true, originalInput: "Normal Line", threshold: 0.8 });
    expect(resFailing.passed).toBe(false);
    expect(resFailing.text).toBe("");
  });

  it("formats null-delimited output (-z)", () => {
    const answer = { choice: "infra", confidence: 0.8, probabilities: { infra: 0.8 } };
    const out = formatChoiceOutput(answer, { quiet: true, null: true });
    expect(out).toBe("infra\0");
  });
});

describe("Spec Normalization for Eval", () => {
  it("normalizes mixed spec definitions", () => {
    const spec = {
      team: { type: "choice", choices: ["auth", "billing"], instructions: "Team" },
      urgent: { type: "noul", instructions: "Urgent?" },
      risk: { type: "score", levels: ["low", "high"], instructions: "Risk" },
    };
    const norm = normalizeSpecQuestions(spec);
    expect(norm.team.type).toBe("choice");
    expect(norm.urgent.type).toBe("noul");
    expect(norm.risk.type).toBe("score");
  });
});

describe("Stream Concurrency & Ordering", () => {
  it("preserves exact input ordering under concurrency", async () => {
    const items = ["item-0", "item-1", "item-2", "item-3", "item-4"];
    const processed: string[] = [];

    await processConcurrentOrdered(
      items,
      3,
      async (item, idx) => {
        // Introduce artificial jitter
        const delay = (5 - idx) * 10;
        await new Promise((r) => setTimeout(r, delay));
        return `done-${item}`;
      },
      (res) => {
        processed.push(res);
      }
    );

    expect(processed).toEqual([
      "done-item-0",
      "done-item-1",
      "done-item-2",
      "done-item-3",
      "done-item-4",
    ]);
  });
});

describe("Skill Registration & Registry Targets", () => {
  it("resolves default local target to .agents/skills/jev-cli/SKILL.md", () => {
    const targets = resolveSkillTargets(undefined, {});
    expect(targets[0]).toContain(path.join(".agents", "skills", "jev-cli", "SKILL.md"));
  });

  it("resolves explicit agent targets correctly", () => {
    const codexTargets = resolveSkillTargets("codex", {});
    expect(codexTargets[0]).toContain(path.join(".agents", "skills", "jev-cli", "SKILL.md"));

    const claudeTargets = resolveSkillTargets("claude", {});
    expect(claudeTargets[0]).toContain(path.join(".claude", "skills", "jev-cli", "SKILL.md"));

    const cursorTargets = resolveSkillTargets("cursor", {});
    expect(cursorTargets[0]).toContain(path.join(".cursor", "skills", "jev-cli", "SKILL.md"));
  });

  it("resolves global targets to home directory", () => {
    const home = os.homedir();
    const globalClaude = resolveSkillTargets("claude", { global: true });
    expect(globalClaude[0]).toEqual(path.join(home, ".claude", "skills", "jev-cli", "SKILL.md"));

    const globalCodex = resolveSkillTargets("codex", { global: true });
    expect(globalCodex).toContain(path.join(home, ".codex", "skills", "jev-cli", "SKILL.md"));
    expect(globalCodex).toContain(path.join(home, ".agents", "skills", "jev-cli", "SKILL.md"));
  });

  it("resolves custom directory flag correctly", () => {
    const custom = resolveSkillTargets(undefined, { dir: "/tmp/custom-registry" });
    expect(custom[0]).toEqual("/tmp/custom-registry/jev-cli/SKILL.md");

    const customDirectMd = resolveSkillTargets(undefined, { dir: "/tmp/my-skill.md" });
    expect(customDirectMd[0]).toEqual("/tmp/my-skill.md");
  });

  it("writes skill file and respects --force", () => {
    const tmpDir = path.join(os.tmpdir(), `jev-skill-test-${Date.now()}`);
    const exitCode = handleAddSkill(undefined, { dir: tmpDir, quiet: true });
    expect(exitCode).toBe(0);

    const expectedFile = path.join(tmpDir, "jev-cli", "SKILL.md");
    expect(fs.existsSync(expectedFile)).toBe(true);
    const content = fs.readFileSync(expectedFile, "utf-8");
    expect(content).toContain("name: jev-cli");

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
