import fs from "node:fs";
import path from "node:path";

export function parsePositiveInt(
  value: string | number | undefined,
  name: string,
  fallback: number
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    const err: any = new Error(`${name} must be a positive integer (got ${value})`);
    err.exitCode = 2;
    throw err;
  }
  return parsed;
}

export function parseNonNegativeInt(
  value: string | number | undefined,
  name: string,
  fallback: number
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    const err: any = new Error(`${name} must be a non-negative integer (got ${value})`);
    err.exitCode = 2;
    throw err;
  }
  return parsed;
}

export function parseThreshold(
  value: string | number | undefined,
  fallback: number = 0.5
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    const err: any = new Error(`threshold must be a number between 0.0 and 1.0 (got ${value})`);
    err.exitCode = 2;
    throw err;
  }
  return parsed;
}

export function readFileSyncSafe(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    const err: any = new Error(`File not found: ${targetPath}`);
    err.exitCode = 2;
    throw err;
  }
  return fs.readFileSync(resolved, "utf-8");
}

export function parseJsonOrString(raw: string): any {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function resolveInstruction(input?: string): any {
  if (!input) return "";

  if (input.startsWith("@")) {
    const filePath = input.slice(1);
    const content = readFileSyncSafe(filePath);
    return parseJsonOrString(content);
  }

  if (input.endsWith(".json") && fs.existsSync(input)) {
    const content = readFileSyncSafe(input);
    return parseJsonOrString(content);
  }

  return parseJsonOrString(input);
}

export function resolveCriteria(input?: string): any {
  if (!input) return undefined;

  let raw = input;
  if (input.startsWith("@")) {
    const filePath = input.slice(1);
    raw = readFileSyncSafe(filePath);
  } else if (input.endsWith(".json") && fs.existsSync(input)) {
    raw = readFileSyncSafe(input);
  }

  try {
    return JSON.parse(raw);
  } catch (err: any) {
    const error: any = new Error(`Invalid criteria JSON: ${err.message}`);
    error.exitCode = 2;
    throw error;
  }
}

export function resolveChoices(choicesStr?: string): string[] {
  if (!choicesStr) return [];

  const trimmed = choicesStr.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fall back to comma-separated
    }
  }

  return choicesStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveLevels(levelsStr?: string): any[] {
  if (!levelsStr) return [];

  let raw = levelsStr;
  if (levelsStr.startsWith("@")) {
    const filePath = levelsStr.slice(1);
    raw = readFileSyncSafe(filePath);
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (err: any) {
      const error: any = new Error(`Invalid levels JSON array: ${err.message}`);
      error.exitCode = 2;
      throw error;
    }
  }

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isStdinPiped(): boolean {
  try {
    const stat = fs.fstatSync(0);
    return stat.isFIFO() || stat.isFile() || stat.isSocket();
  } catch {
    return false;
  }
}

export async function readStdinFull(): Promise<string> {
  if (!isStdinPiped()) {
    return "";
  }

  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
    process.stdin.on("error", (err) => {
      reject(err);
    });
  });
}
