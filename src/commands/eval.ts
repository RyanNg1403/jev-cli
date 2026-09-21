import fs from "node:fs";
import { choice, noul, score } from "@typesafe-ai/sdk";
import { JevService } from "../client";
import type { EvalOptions } from "../types";
import {
  readStdinFull,
  readFileSyncSafe,
  parseJsonOrString,
  isStdinPiped,
  parsePositiveInt,
  parseNonNegativeInt,
} from "../utils/input";
import { printUsage, writeDelimiter } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export function normalizeSpecQuestions(specObj: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, q] of Object.entries(specObj)) {
    if (!q || typeof q !== "object") {
      const err: any = new Error(`Invalid question definition for '${key}' in spec.`);
      err.exitCode = 2;
      throw err;
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
      const err: any = new Error(`Unknown question type '${q.type}' for key '${key}' in spec.`);
      err.exitCode = 2;
      throw err;
    }
  }

  return normalized;
}

export async function handleEval(files: string[], options: EvalOptions): Promise<number> {
  if (!options.spec) {
    process.stderr.write("Error: --spec (-s) is required for 'jev eval'.\n");
    return 2;
  }

  if (options.stream && files && files.length > 0) {
    process.stderr.write("Error: Cannot combine --stream with positional file arguments.\n");
    return 2;
  }

  let specRaw: any;
  try {
    if (options.spec.startsWith("@") || options.spec.endsWith(".json")) {
      const p = options.spec.startsWith("@") ? options.spec.slice(1) : options.spec;
      specRaw = JSON.parse(readFileSyncSafe(p));
    } else {
      specRaw = JSON.parse(options.spec);
    }
  } catch (err: any) {
    process.stderr.write(`Error: Invalid spec JSON: ${err.message}\n`);
    return 2;
  }

  const questions = normalizeSpecQuestions(specRaw);
  const concurrency = parsePositiveInt(options.concurrency, "concurrency", 10);
  const retries = options.retries !== undefined ? parseNonNegativeInt(options.retries, "retries", 3) : undefined;
  const timeout = options.timeout !== undefined ? Number(options.timeout) : undefined;

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout,
    retries,
  });

  const delim = writeDelimiter(Boolean(options.null));

  // Stream mode
  if (options.stream) {
    const stream = readStreamItems(process.stdin, Boolean(options.null));

    await processConcurrentOrdered(
      stream,
      concurrency,
      async (item, _idx, signal) => {
        const state = parseJsonOrString(item);
        const res = await service.evaluate(state, questions, signal);
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

  // Multi-file batch mode vs positional state string
  let state: any;
  if (files && files.length > 0) {
    if (files.length === 1 && !fs.existsSync(files[0])) {
      state = parseJsonOrString(files[0]);
    } else {
      await processConcurrentOrdered(
        files,
        concurrency,
        async (filePath, _idx, signal) => {
          const content = readFileSyncSafe(filePath);
          const s = options.jsonState ? parseJsonOrString(content) : content;
          const res = await service.evaluate(s, questions, signal);
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
  }

  // Single item mode
  if (state === undefined) {
    if (options.jsonState) {
      if (options.jsonState.startsWith("@") || options.jsonState.endsWith(".json")) {
        const p = options.jsonState.startsWith("@") ? options.jsonState.slice(1) : options.jsonState;
        state = JSON.parse(readFileSyncSafe(p));
      } else {
        state = JSON.parse(options.jsonState);
      }
    } else if (isStdinPiped()) {
      state = parseJsonOrString(await readStdinFull());
    } else {
      process.stderr.write("Error: No input provided via stdin, positional argument, or [FILES...].\n");
      return 2;
    }
  }

  const res = await service.evaluate(state, questions);

  if (options.usage) {
    printUsage(res.usage);
  }

  if (options.null) {
    process.stdout.write(JSON.stringify(res.answers) + "\0");
  } else {
    process.stdout.write(JSON.stringify(res.answers, null, 2) + "\n");
  }
  return 0;
}
