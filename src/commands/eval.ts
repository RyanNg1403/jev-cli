import { choice, noul, score } from "@typesafe-ai/sdk";
import { JevService } from "../client";
import type { EvalOptions } from "../types";
import {
  readStdinFull,
  readFileSyncSafe,
  parseJsonOrString,
} from "../utils/input";
import { printUsage, writeDelimiter } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export function normalizeSpecQuestions(specObj: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, q] of Object.entries(specObj)) {
    if (!q || typeof q !== "object") {
      throw new Error(`Invalid question definition for '${key}' in spec.`);
    }

    const type = q.type?.toLowerCase();
    const instructions = q.instructions ?? q.instruction ?? "";

    if (type === "choice") {
      let criteria = q.criteria;
      if (!criteria && q.choices) {
        criteria = {};
        const list = Array.isArray(q.choices) ? q.choices : String(q.choices).split(",");
        for (const c of list) {
          criteria[String(c).trim()] = null;
        }
      } else if (Array.isArray(criteria)) {
        const map: Record<string, any> = {};
        for (const c of criteria) {
          map[String(c)] = null;
        }
        criteria = map;
      }
      normalized[key] = choice(instructions, criteria);
    } else if (type === "noul") {
      normalized[key] = noul(instructions, q.criteria);
    } else if (type === "score") {
      const levels = q.criteria ?? q.levels ?? [];
      normalized[key] = score(instructions, levels);
    } else {
      throw new Error(`Unknown question type '${q.type}' for key '${key}' in spec.`);
    }
  }

  return normalized;
}

export async function handleEval(files: string[], options: EvalOptions): Promise<number> {
  if (!options.spec) {
    process.stderr.write("Error: --spec (-s) is required for 'jev eval'.\n");
    return 2;
  }

  let specRaw: any;
  if (options.spec.startsWith("@") || options.spec.endsWith(".json")) {
    const p = options.spec.startsWith("@") ? options.spec.slice(1) : options.spec;
    specRaw = JSON.parse(readFileSyncSafe(p));
  } else {
    specRaw = JSON.parse(options.spec);
  }

  const questions = normalizeSpecQuestions(specRaw);

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout: options.timeout ? Number(options.timeout) : undefined,
    retries: options.retries ? Number(options.retries) : undefined,
  });

  const concurrency = options.concurrency ? Number(options.concurrency) : 10;
  const delim = writeDelimiter(Boolean(options.null));

  // Stream mode
  if (options.stream) {
    const items = await readStreamItems(process.stdin, Boolean(options.null));
    if (items.length === 0) return 0;

    await processConcurrentOrdered(
      items,
      concurrency,
      async (item) => {
        const state = parseJsonOrString(item);
        const res = await service.evaluate(state, questions);
        return res;
      },
      (res) => {
        if (options.usage) {
          printUsage(res.usage);
        }
        process.stdout.write(JSON.stringify(res.answers) + delim);
      }
    );

    return 0;
  }

  // Multi-file batch mode
  if (files && files.length > 0) {
    await processConcurrentOrdered(
      files,
      concurrency,
      async (filePath) => {
        const content = readFileSyncSafe(filePath);
        const state = options.jsonState ? parseJsonOrString(content) : content;
        const res = await service.evaluate(state, questions);
        return { filePath, res };
      },
      ({ filePath, res }) => {
        if (options.usage) {
          printUsage(res.usage);
        }
        const output = {
          file: filePath,
          answers: res.answers,
        };
        process.stdout.write(JSON.stringify(output) + delim);
      }
    );

    return 0;
  }

  // Single item mode
  let state: any;
  if (options.jsonState) {
    if (options.jsonState.startsWith("@") || options.jsonState.endsWith(".json")) {
      const p = options.jsonState.startsWith("@") ? options.jsonState.slice(1) : options.jsonState;
      state = JSON.parse(readFileSyncSafe(p));
    } else {
      state = JSON.parse(options.jsonState);
    }
  } else {
    state = await readStdinFull();
  }

  const res = await service.evaluate(state, questions);

  if (options.usage) {
    printUsage(res.usage);
  }

  process.stdout.write(JSON.stringify(res.answers, null, 2) + "\n");
  return 0;
}
