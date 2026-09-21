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
} from "../utils/input";
import { formatNoulOutput, printUsage } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export async function handleNoul(files: string[], options: NoulOptions): Promise<number> {
  const instruction = resolveInstruction(options.instruction || options.i);
  if (!instruction) {
    process.stderr.write("Error: --instruction (-i) is required for 'jev noul'.\n");
    return 2;
  }

  const criteria = resolveCriteria(options.criteria);

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout: options.timeout ? Number(options.timeout) : undefined,
    retries: options.retries ? Number(options.retries) : undefined,
  });

  const threshold = options.threshold !== undefined ? Number(options.threshold) : 0.5;
  const concurrency = options.concurrency ? Number(options.concurrency) : 10;
  let matchCount = 0;
  let totalCount = 0;
  let allPassed = true;
  let state: any;
  let rawInput = "";

  // Stream mode
  if (options.stream) {
    const items = await readStreamItems(process.stdin, Boolean(options.null));
    if (items.length === 0) return 1;

    await processConcurrentOrdered(
      items,
      concurrency,
      async (item) => {
        const s = parseJsonOrString(item);
        const res = await service.evaluate(s, {
          noul_q: noul(instruction, criteria),
        });
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
        async (filePath) => {
          const content = readFileSyncSafe(filePath);
          const s = options.jsonState ? parseJsonOrString(content) : content;
          const res = await service.evaluate(s, {
            noul_q: noul(instruction, criteria),
          });
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

  // Single item mode (stdin or jsonState or positional arg)
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
    } else {
      rawInput = await readStdinFull();
      state = parseJsonOrString(rawInput);
    }
  }

  const res = await service.evaluate(state, {
    noul_q: noul(instruction, criteria),
  });

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
