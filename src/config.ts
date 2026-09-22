import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { JevConfig } from "./types";

const JEV_HOME_DIR = path.join(os.homedir(), ".jev");
const JEV_CONFIG_FILE = path.join(JEV_HOME_DIR, "config.json");
const XDG_CONFIG_DIR = path.join(os.homedir(), ".config", "jev");
const XDG_CONFIG_FILE = path.join(XDG_CONFIG_DIR, "config.json");

export function getHomeDir(): string {
  return JEV_HOME_DIR;
}

export function getConfigFile(): string {
  if (fs.existsSync(JEV_CONFIG_FILE)) return JEV_CONFIG_FILE;
  if (fs.existsSync(XDG_CONFIG_FILE)) return XDG_CONFIG_FILE;
  return JEV_CONFIG_FILE;
}

export function loadStoredConfig(): JevConfig {
  const candidates = [
    path.join(process.cwd(), ".jev", "config.json"),
    JEV_CONFIG_FILE,
    XDG_CONFIG_FILE,
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const data = fs.readFileSync(file, "utf-8");
        return JSON.parse(data) as JevConfig;
      }
    } catch {
      // Ignore corrupt or unreadable config
    }
  }
  return {};
}

export function saveStoredConfig(config: Partial<JevConfig>): void {
  const targetFile = getConfigFile();
  const targetDir = path.dirname(targetFile);

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(targetDir, 0o700);
      } catch {
        // Best effort
      }
    }
    const current = loadStoredConfig();
    const updated = { ...current, ...config };
    fs.writeFileSync(targetFile, JSON.stringify(updated, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch (err: any) {
    throw new Error(`Failed to save config to ${targetFile}: ${err.message}`);
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
    path.join(process.cwd(), ".jev", ".env"),
    path.join(os.homedir(), ".jev", ".env"),
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
    "No TypeSafe API key found. Run 'jev auth set-key <key>' or set $TYPESAFE_API_KEY / $JEV_API_KEY."
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
