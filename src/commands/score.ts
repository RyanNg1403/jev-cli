import { score } from "@typesafe-ai/sdk";
import { JevService } from "../client";
import type { ScoreOptions } from "../types";
import {
  resolveLevels,
  resolveInstruction,
  readStdinFull,
  readFileSyncSafe,
  parseJsonOrString,
} from "../utils/input";
import { formatScoreOutput, printUsage } from "../utils/format";
import { readStreamItems, processConcurrentOrdered } from "../utils/stream";

export async function handleScore(files: string[], options: ScoreOptions): Promise<number> {
  const instruction = resolveInstruction(options.instruction || options.i);
  if (!instruction) {
    process.stderr.write("Error: --instruction (-i) is required for 'jev score'.\n");
    return 2;
  }

  const levels = resolveLevels(options.levels);
  if (!levels || levels.length < 2) {
    process.stderr.write("Error: --levels (-l) must define at least 2 descriptive levels.\n");
    return 2;
  }

  const service = new JevService({
    apiKey: options.apiKey,
    model: options.model,
    timeout: options.timeout ? Number(options.timeout) : undefined,
    retries: options.retries ? Number(options.retries) : undefined,
  });

  const concurrency = options.concurrency ? Number(options.concurrency) : 10;

  // Stream mode
  if (options.stream) {
    const items = await readStreamItems(process.stdin, Boolean(options.null));
    if (items.length === 0) return 0;

    await processConcurrentOrdered(
      items,
      concurrency,
      async (item) => {
        const state = parseJsonOrString(item);
        const res = await service.evaluate(state, {
          score_q: score(instruction, levels),
        });
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

  // Multi-file batch mode
  if (files && files.length > 0) {
    await processConcurrentOrdered(
      files,
      concurrency,
      async (filePath) => {
        const content = readFileSyncSafe(filePath);
        const state = options.jsonState ? parseJsonOrString(content) : content;
        const res = await service.evaluate(state, {
          score_q: score(instruction, levels),
        });
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

  const res = await service.evaluate(state, {
    score_q: score(instruction, levels),
  });

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
