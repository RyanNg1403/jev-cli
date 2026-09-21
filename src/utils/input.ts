import fs from "node:fs";
import path from "node:path";

export function readFileSyncSafe(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${targetPath}`);
  }
  return fs.readFileSync(resolved, "utf-8");
}

export function parseJsonOrString(raw: string): any {
  const trimmed = raw.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || 
      (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
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

  if (input.startsWith("@")) {
    const filePath = input.slice(1);
    const content = readFileSyncSafe(filePath);
    return JSON.parse(content);
  }

  if (input.endsWith(".json") && fs.existsSync(input)) {
    const content = readFileSyncSafe(input);
    return JSON.parse(content);
  }

  const trimmed = input.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  return undefined;
}

export function resolveChoices(choicesStr?: string): string[] {
  if (!choicesStr) return [];

  const trimmed = choicesStr.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
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

  if (levelsStr.startsWith("@")) {
    const filePath = levelsStr.slice(1);
    const content = readFileSyncSafe(filePath);
    return JSON.parse(content);
  }

  const trimmed = levelsStr.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall back to comma-separated
    }
  }

  return levelsStr
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

