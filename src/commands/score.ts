import fs from "node:fs";
import { score } from "@typesafe-ai/sdk";
import { JevService } from "../client";
import type { ScoreOptions } from "../types";
import {
  resolveLevels,
  resolveInstruction,
  readStdinFull,
  readFileSyncSafe,
  parseJsonOrString,
  isStdinPiped,
  parsePositiveInt,
  parseNonNegativeInt,
} from "../utils/input";
import { formatScoreOutput, printUsage } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export async function handleScore(files: string[], options: ScoreOptions): Promise<number> {
  const instruction = resolveInstruction(options.instruction || options.i);
  if (!instruction) {
    process.stderr.write("Error: --instruction (-i) is required for 'jev score'.\n");
    return 2;
  }

  if (options.stream && files && files.length > 0) {
    process.stderr.write("Error: Cannot combine --stream with positional file arguments.\n");
    return 2;
  }

  const levels = resolveLevels(options.levels);
  if (!levels || levels.length < 2) {
    process.stderr.write("Error: --levels (-l) must define at least 2 descriptive levels.\n");
    return 2;
  }

  const concurrency = parsePositiveInt(options.concurrency, "concurrency", 10);
  const retries = options.retries !== undefined ? parseNonNegativeInt(options.retries, "retries", 3) : undefined;
  const timeout = options.timeout !== undefined ? Number(options.timeout) : undefined;

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout,
    retries,
  });

  const question = score(instruction, levels as [any, any, ...any[]]);
  const questions = { score_q: question };

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
        const answer = res.answers?.score_q;
        if (answer) {
          process.stdout.write(formatScoreOutput(answer, options));
        }
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
        ({ res }) => {
          if (options.usage) {
            printUsage(res.usage);
          }
          const answer = res.answers?.score_q;
          if (answer) {
            process.stdout.write(formatScoreOutput(answer, options));
          }
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

  const answer = res.answers?.score_q;
  if (answer) {
    process.stdout.write(formatScoreOutput(answer, options));
    return 0;
  }

  return 1;
}
