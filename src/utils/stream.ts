export type InputStream = NodeJS.ReadableStream &
  AsyncIterable<string | Buffer> & {
    setEncoding(encoding: BufferEncoding): void;
  };

/**
 * Reads items from a stream on the fly as an async generator, yielding records
 * separated by \n (or \r\n) or \0 as soon as they arrive without buffering the entire stream.
 */
export async function* readStreamItems(
  stream: InputStream,
  nullDelimited = false
): AsyncGenerator<string> {
  stream.setEncoding("utf-8");

  const delimiter = nullDelimited ? "\0" : "\n";
  let buffer = "";

  for await (const chunk of stream) {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf-8");

    let index: number;
    while ((index = buffer.indexOf(delimiter)) !== -1) {
      let item = buffer.slice(0, index);
      if (!nullDelimited && item.endsWith("\r")) {
        item = item.slice(0, -1);
      }

      yield item;
      buffer = buffer.slice(index + delimiter.length);
    }
  }

  if (buffer.length > 0) {
    yield nullDelimited || !buffer.endsWith("\r")
      ? buffer
      : buffer.slice(0, -1);
  }
}

/**
 * Concurrently processes items from an Iterable or AsyncIterable with a fixed concurrency limit,
 * applying natural input backpressure and yielding results in exact input order.
 * If any task rejects, remaining tasks are cancelled and the error is propagated.
 */
export async function processConcurrentOrdered<T, R>(
  items: Iterable<T> | AsyncIterable<T>,
  limit: number,
  task: (item: T, index: number, signal?: AbortSignal) => Promise<R>,
  onResult: (result: R, index: number) => void | Promise<void>
): Promise<void> {
  const boundedLimit = Math.max(1, Number.isSafeInteger(limit) ? limit : 4);
  const abortController = new AbortController();

  const isAsync = Symbol.asyncIterator in items;
  const iterator = isAsync
    ? (items as AsyncIterable<T>)[Symbol.asyncIterator]()
    : (function* () {
        for (const item of items as Iterable<T>) {
          yield item;
        }
      })();

  const pending = new Map<number, Promise<R>>();
  let nextIndex = 0;
  let nextToFlush = 0;
  let done = false;

  const fill = async () => {
    while (!done && pending.size < boundedLimit && !abortController.signal.aborted) {
      const next = await iterator.next();
      if (next.done) {
        done = true;
        break;
      }

      const index = nextIndex++;
      const promise = task(next.value, index, abortController.signal).catch((err) => {
        abortController.abort();
        throw err;
      });
      pending.set(index, promise);
    }
  };

  try {
    await fill();

    while (pending.size > 0) {
      const resultPromise = pending.get(nextToFlush);
      if (!resultPromise) {
        throw new Error(`Missing result for item index ${nextToFlush}`);
      }

      const result = await resultPromise;
      pending.delete(nextToFlush);

      await onResult(result, nextToFlush);
      nextToFlush++;

      await fill();
    }
  } catch (err) {
    abortController.abort();
    throw err;
  } finally {
    if (isAsync && "return" in iterator && typeof iterator.return === "function") {
      await iterator.return();
    }
  }
}
