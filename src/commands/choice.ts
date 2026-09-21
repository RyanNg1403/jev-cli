import fs from "node:fs";
import { choice } from "@typesafe-ai/sdk";
import { JevService } from "../client";
import type { ChoiceOptions } from "../types";
import {
  resolveChoices,
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
import { formatChoiceOutput, printUsage } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export async function handleChoice(files: string[], options: ChoiceOptions): Promise<number> {
  const instruction = resolveInstruction(options.instruction || options.i);
  if (!instruction) {
    process.stderr.write("Error: --instruction (-i) is required for 'jev choice'.\n");
    return 2;
  }

  if (options.stream && files && files.length > 0) {
    process.stderr.write("Error: Cannot combine --stream with positional file arguments.\n");
    return 2;
  }

  let criteriaMap: Record<string, string | null> | undefined;

  if (options.criteria) {
    criteriaMap = resolveCriteria(options.criteria);
  } else if (options.choices) {
    const list = resolveChoices(options.choices);
    if (list.length === 0) {
      process.stderr.write("Error: --choices must contain at least one choice option.\n");
      return 2;
    }
    criteriaMap = Object.create(null);
    for (const item of list) {
      criteriaMap![item] = null;
    }
  } else {
    process.stderr.write("Error: Either --choices or --criteria is required for 'jev choice'.\n");
    return 2;
  }

  const concurrency = parsePositiveInt(options.concurrency, "concurrency", 10);
  const threshold = parseThreshold(options.threshold, 0.0);
  const retries = options.retries !== undefined ? parseNonNegativeInt(options.retries, "retries", 3) : undefined;
  const timeout = options.timeout !== undefined ? Number(options.timeout) : undefined;

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout,
    retries,
  });

  const question = choice(instruction, criteriaMap!);
  const questions = { choice_q: question };
  let exitCode = 0;
  let state: any;

  // Stream mode
  if (options.stream) {
    const stream = readStreamItems(process.stdin, Boolean(options.null));

    await processConcurrentOrdered(
      stream,
      concurrency,
      async (item, _idx, signal) => {
        const s = parseJsonOrString(item);
        const res = await service.evaluate(s, questions, signal);
        return res;
      },
      (res) => {
        const answer = res.answers?.choice_q;
        if (options.usage) {
          printUsage(res.usage);
        }
        if (answer) {
          if ((answer.confidence ?? 0) < threshold) {
            exitCode = 1;
          }
          process.stdout.write(formatChoiceOutput(answer, options));
        }
      }
    );

    return exitCode;
  }

  // Multi-file batch mode vs single positional argument
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
          const answer = res.answers?.choice_q;
          if (options.usage) {
            printUsage(res.usage);
          }
          if (answer) {
            if ((answer.confidence ?? 0) < threshold) {
              exitCode = 1;
            }
            process.stdout.write(formatChoiceOutput(answer, options));
          }
        }
      );

      return exitCode;
    }
  }

  // Single item mode (jsonState or stdin or positional arg)
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

  const answer = res.answers?.choice_q;
  if (answer) {
    if ((answer.confidence ?? 0) < threshold) {
      exitCode = 1;
    }
    process.stdout.write(formatChoiceOutput(answer, options));
  }

  return exitCode;
}
