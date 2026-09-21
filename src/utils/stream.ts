import readline from "node:readline";
import fs from "node:fs";

export async function readStreamItems(
  stream: NodeJS.ReadableStream,
  nullDelimited: boolean = false
): Promise<string[]> {
  if (nullDelimited) {
    return new Promise((resolve, reject) => {
      let buffer = "";
      const items: string[] = [];
      stream.setEncoding("utf-8");
      stream.on("data", (chunk: string) => {
        buffer += chunk;
        const parts = buffer.split("\0");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (part.length > 0) items.push(part);
        }
      });
      stream.on("end", () => {
        if (buffer.length > 0) items.push(buffer);
        resolve(items);
      });
      stream.on("error", reject);
    });
  }

  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });
    const items: string[] = [];
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (trimmed) items.push(trimmed);
    });
    rl.on("close", () => resolve(items));
    rl.on("error", reject);
  });
}

/**
 * Concurrently processes an array of items with a fixed concurrency limit,
 * yielding results in the original order as they finish.
 */
export async function processConcurrentOrdered<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  onResult: (result: R, index: number) => void
): Promise<void> {
  const results = new Map<number, R>();
  let nextToFlush = 0;
  let activeCount = 0;
  let cursor = 0;

  return new Promise((resolve, reject) => {
    function flush() {
      while (results.has(nextToFlush)) {
        const res = results.get(nextToFlush)!;
        results.delete(nextToFlush);
        try {
          onResult(res, nextToFlush);
        } catch (err) {
          return reject(err);
        }
        nextToFlush++;
      }
      if (nextToFlush === items.length) {
        resolve();
      }
    }

    function runNext() {
      while (activeCount < limit && cursor < items.length) {
        const index = cursor++;
        const item = items[index];
        activeCount++;

        task(item, index)
          .then((res) => {
            results.set(index, res);
            activeCount--;
            flush();
            runNext();
          })
          .catch((err) => {
            reject(err);
          });
      }
    }

    if (items.length === 0) {
      resolve();
      return;
    }

    runNext();
  });
}
