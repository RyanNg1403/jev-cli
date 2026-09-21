import fs from "node:fs";
import { noul } from "@typesafe-ai/sdk";
import { JevService } from "../client";
import type { NoulOptions } from "../types";
import {
  resolveCriteria,
  resolveInstruction,
  readStdinFull,
  readFileSyncSafe,
  parseJsonOrString,
  isStdinPiped,
  parsePositiveInt,
  parseNonNegativeInt,
  parseThreshold,
} from "../utils/input";
import { formatNoulOutput, printUsage } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export async function handleNoul(files: string[], options: NoulOptions): Promise<number> {
  const instruction = resolveInstruction(options.instruction || options.i);
  if (!instruction) {
    process.stderr.write("Error: --instruction (-i) is required for 'jev noul'.\n");
    return 2;
  }

  if (options.stream && files && files.length > 0) {
    process.stderr.write("Error: Cannot combine --stream with positional file arguments.\n");
    return 2;
  }

  const criteria = resolveCriteria(options.criteria);
  const concurrency = parsePositiveInt(options.concurrency, "concurrency", 10);
  const threshold = parseThreshold(options.threshold, 0.5);
  const retries = options.retries !== undefined ? parseNonNegativeInt(options.retries, "retries", 3) : undefined;
  const timeout = options.timeout !== undefined ? Number(options.timeout) : undefined;

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout,
    retries,
  });

  const question = noul(instruction, criteria);
  const questions = { noul_q: question };

  let matchCount = 0;
  let totalCount = 0;
  let allPassed = true;
  let state: any;
  let rawInput = "";

  // Stream mode
  if (options.stream) {
    const stream = readStreamItems(process.stdin, Boolean(options.null));

    await processConcurrentOrdered(
      stream,
      concurrency,
      async (item, _idx, signal) => {
        const s = parseJsonOrString(item);
        const res = await service.evaluate(s, questions, signal);
        return { item, res };
      },
      ({ item, res }) => {
        totalCount++;
        if (options.usage) {
          printUsage(res.usage);
        }
        const answer = res.answers?.noul_q;
        if (answer) {
          const { text, passed } = formatNoulOutput(answer, {
            quiet: options.quiet,
            prob: options.prob,
            json: options.json,
            null: options.null,
            threshold,
            filter: options.filter,
            originalInput: item,
          });
          if (passed) matchCount++;
          else allPassed = false;

          process.stdout.write(text);
        }
      }
    );

    if (totalCount === 0) return 1;
    if (options.filter) {
      return matchCount > 0 ? 0 : 1;
    }
    return allPassed ? 0 : 1;
  }

  // Multi-file batch mode vs positional state string
  if (files && files.length > 0) {
    if (files.length === 1 && !fs.existsSync(files[0])) {
      rawInput = files[0];
      state = parseJsonOrString(rawInput);
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
          totalCount++;
          if (options.usage) {
            printUsage(res.usage);
          }
          const answer = res.answers?.noul_q;
          if (answer) {
            const { text, passed } = formatNoulOutput(answer, {
              quiet: options.quiet,
              prob: options.prob,
              json: options.json,
              null: options.null,
              threshold,
              filter: options.filter,
              originalInput: filePath,
            });
            if (passed) matchCount++;
            else allPassed = false;

            process.stdout.write(text);
          }
        }
      );

      if (options.filter) {
        return matchCount > 0 ? 0 : 1;
      }
      return allPassed ? 0 : 1;
    }
  }

  // Single item mode (jsonState or stdin or positional arg)
  if (state === undefined) {
    if (options.jsonState) {
      if (options.jsonState.startsWith("@") || options.jsonState.endsWith(".json")) {
        const p = options.jsonState.startsWith("@") ? options.jsonState.slice(1) : options.jsonState;
        rawInput = readFileSyncSafe(p);
        state = JSON.parse(rawInput);
      } else {
        rawInput = options.jsonState;
        state = JSON.parse(options.jsonState);
      }
    } else if (isStdinPiped()) {
      rawInput = await readStdinFull();
      state = parseJsonOrString(rawInput);
    } else {
      process.stderr.write("Error: No input provided via stdin, positional argument, or [FILES...].\n");
      return 2;
    }
  }

  const res = await service.evaluate(state, questions);

  if (options.usage) {
    printUsage(res.usage);
  }

  const answer = res.answers?.noul_q;
  if (answer) {
    const { text, passed } = formatNoulOutput(answer, {
      quiet: options.quiet,
      prob: options.prob,
      json: options.json,
      null: options.null,
      threshold,
      filter: options.filter,
      originalInput: rawInput,
    });
    process.stdout.write(text);
    return passed ? 0 : 1;
  }

  return 1;
}
