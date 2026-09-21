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
