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
} from "../utils/input";
import { formatChoiceOutput, printUsage } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export async function handleChoice(files: string[], options: ChoiceOptions): Promise<number> {
  const instruction = resolveInstruction(options.instruction || options.i);
  if (!instruction) {
    process.stderr.write("Error: --instruction (-i) is required for 'jev choice'.\n");
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
    criteriaMap = {};
    for (const item of list) {
      criteriaMap[item] = null;
    }
  } else {
    process.stderr.write("Error: Either --choices or --criteria is required for 'jev choice'.\n");
    return 2;
  }

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout: options.timeout ? Number(options.timeout) : undefined,
    retries: options.retries ? Number(options.retries) : undefined,
  });

  const threshold = options.threshold !== undefined ? Number(options.threshold) : 0.0;
  const concurrency = options.concurrency ? Number(options.concurrency) : 10;
  let exitCode = 0;
  let state: any;

  // Stream mode
  if (options.stream) {
    const items = await readStreamItems(process.stdin, Boolean(options.null));
    if (items.length === 0) return 0;

    await processConcurrentOrdered(
      items,
      concurrency,
      async (item) => {
        const s = parseJsonOrString(item);
        const res = await service.evaluate(s, {
          choice_q: choice(instruction, criteriaMap!),
        });
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

  // Multi-file batch mode vs positional state string
  if (files && files.length > 0) {
    if (files.length === 1 && !fs.existsSync(files[0])) {
      state = files[0];
    } else {
      await processConcurrentOrdered(
        files,
        concurrency,
        async (filePath) => {
          const content = readFileSyncSafe(filePath);
          const s = options.jsonState ? parseJsonOrString(content) : content;
          const res = await service.evaluate(s, {
            choice_q: choice(instruction, criteriaMap!),
          });
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

  // Single item mode (stdin or jsonState or positional arg)
  if (state === undefined) {
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
  }

  const res = await service.evaluate(state, {
    choice_q: choice(instruction, criteriaMap!),
  });

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
