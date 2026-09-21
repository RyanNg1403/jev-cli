import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { JevConfig } from "./types";

const CONFIG_DIR = path.join(os.homedir(), ".config", "jev");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function getConfigFile(): string {
  return CONFIG_FILE;
}

export function loadStoredConfig(): JevConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data) as JevConfig;
    }
  } catch {
    // Ignore corrupt or unreadable config
  }
  return {};
}

export function saveStoredConfig(config: Partial<JevConfig>): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(CONFIG_DIR, 0o700);
      } catch {
        // Best effort
      }
    }
    const current = loadStoredConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch (err: any) {
    throw new Error(`Failed to save config to ${CONFIG_FILE}: ${err.message}`);
  }
}

/**
 * Searches for a .env file upwards starting from startDir
 */
export function findDotEnv(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir && dir !== root) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Simple .env parser that reads KEY=VALUE without external dependencies
 */
export function loadDotEnv(): Record<string, string> {
  const envVars: Record<string, string> = {};

  const locations = [
    findDotEnv(process.cwd()),
    path.join(os.homedir(), ".jev.env"),
  ].filter((loc): loc is string => Boolean(loc && fs.existsSync(loc)));

  for (const file of locations) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!(key in envVars)) {
            envVars[key] = val;
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return envVars;
}

export function resolveApiKey(explicitKey?: string): string {
  if (explicitKey) return explicitKey;

  const dotEnv = loadDotEnv();

  const envKey =
    process.env.TYPESAFE_API_KEY ||
    process.env.JEV_API_KEY ||
    dotEnv.TYPESAFE_API_KEY ||
    dotEnv.JEV_API_KEY;

  if (envKey) return envKey;

  const stored = loadStoredConfig();
  if (stored.apiKey) return stored.apiKey;

  const err: any = new Error(
    "No TypeSafe API key found. Set $TYPESAFE_API_KEY or $JEV_API_KEY in your environment, or pass --api-key <key>."
  );
  err.exitCode = 3;
  throw err;
}

export function resolveModel(explicitModel?: string): string {
  if (explicitModel) return explicitModel;

  if (process.env.JEV_MODEL) return process.env.JEV_MODEL;
  if (process.env.TYPESAFE_DEFAULT_MODEL) return process.env.TYPESAFE_DEFAULT_MODEL;

  const dotEnv = loadDotEnv();
  if (dotEnv.JEV_MODEL) return dotEnv.JEV_MODEL;
  if (dotEnv.TYPESAFE_DEFAULT_MODEL) return dotEnv.TYPESAFE_DEFAULT_MODEL;

  const stored = loadStoredConfig();
  if (stored.defaultModel) return stored.defaultModel;

  return "jev-latest";
}

/**
 * Calculates cost based on Jev's $0.042 per Mtok ($42 per Btok) pricing.
 * Output tokens are free.
 */
export function calculateCost(inputTokens: number): number {
  return (inputTokens / 1_000_000) * 0.042;
}
