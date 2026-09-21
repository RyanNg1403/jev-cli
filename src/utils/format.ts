import { calculateCost } from "../config";

export function writeDelimiter(nullDelimited: boolean): string {
  return nullDelimited ? "\0" : "\n";
}

export function printUsage(usage?: { input_tokens: number; output_tokens: number }): void {
  if (!usage) return;
  const cost = calculateCost(usage.input_tokens);
  const costStr = cost < 0.0001 ? `$${cost.toFixed(6)}` : `$${cost.toFixed(4)}`;
  process.stderr.write(
    `[jev] usage: ${usage.input_tokens} in / ${usage.output_tokens} out tokens (est. ${costStr})\n`
  );
}

export function formatChoiceOutput(
  answer: any,
  options: {
    quiet?: boolean;
    tsv?: boolean;
    json?: boolean;
    null?: boolean;
  }
): string {
  const delim = writeDelimiter(Boolean(options.null));
  const winner = answer.choice;
  const confidence = answer.confidence ?? 0;
  const distribution = answer.probabilities ?? {};
  const prob = distribution[winner] ?? 0;

  if (options.quiet) {
    return `${winner}${delim}`;
  }

  if (options.tsv) {
    return `${winner}\t${prob}\t${confidence}${delim}`;
  }

  if (options.json) {
    const payload = {
      winner,
      probability: prob,
      confidence,
      distribution,
    };
    return JSON.stringify(payload, null, 2) + "\n";
  }

  // Default readable format
  return `${winner} (${(prob * 100).toFixed(1)}%, conf: ${(confidence * 100).toFixed(1)}%)${delim}`;
}

export function formatNoulOutput(
  answer: any,
  options: {
    quiet?: boolean;
    prob?: boolean;
    json?: boolean;
    null?: boolean;
    threshold?: number;
    filter?: boolean;
    originalInput?: string;
  }
): { text: string; passed: boolean } {
  const delim = writeDelimiter(Boolean(options.null));
  const probability = answer.noul ?? 0;
  const threshold = options.threshold ?? 0.5;
  const passed = probability >= threshold;

  if (options.filter) {
    if (passed && options.originalInput !== undefined) {
      return { text: `${options.originalInput}${delim}`, passed };
    }
    return { text: "", passed };
  }

  if (options.quiet) {
    return { text: `${passed}${delim}`, passed };
  }

  if (options.prob) {
    return { text: `${probability}${delim}`, passed };
  }

  if (options.json) {
    const payload = {
      answer: passed,
      probability,
    };
    return { text: JSON.stringify(payload, null, 2) + "\n", passed };
  }

  return {
    text: `${passed ? "true" : "false"} (P=${(probability * 100).toFixed(1)}%)${delim}`,
    passed,
  };
}

export function formatScoreOutput(
  answer: any,
  options: {
    quiet?: boolean;
    value?: boolean;
    json?: boolean;
    null?: boolean;
  }
): string {
  const delim = writeDelimiter(Boolean(options.null));
  const scoreVal = answer.score ?? 0;
  const legend = answer.legend ?? {};
  const probabilities = answer.probabilities ?? {};
  const confidence = answer.confidence ?? 0;

  // Best level is highest probability or rounded index
  let bestLevel = "";
  let highestP = -1;
  for (const [lvl, p] of Object.entries(probabilities)) {
    if ((p as number) > highestP) {
      highestP = p as number;
      bestLevel = legend[lvl] || lvl;
    }
  }

  if (options.quiet) {
    return `${bestLevel}${delim}`;
  }

  if (options.value) {
    return `${scoreVal}${delim}`;
  }

  if (options.json) {
    const payload = {
      score: scoreVal,
      winning_level: bestLevel,
      legend,
      probabilities,
      confidence,
    };
    return JSON.stringify(payload, null, 2) + "\n";
  }

  return `${bestLevel} (score: ${scoreVal.toFixed(2)}, conf: ${(confidence * 100).toFixed(1)}%)${delim}`;
}
