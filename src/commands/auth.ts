import {
  loadStoredConfig,
  saveStoredConfig,
  getConfigFile,
  resolveApiKey,
  loadDotEnv,
} from "../config";

export function handleAuthSetKey(apiKey?: string): number {
  if (!apiKey) {
    process.stderr.write("Error: API key is required.\nUsage: jev auth set-key <key>\n");
    return 2;
  }

  const trimmed = apiKey.trim();
  if (!trimmed) {
    process.stderr.write("Error: API key cannot be empty.\n");
    return 2;
  }

  saveStoredConfig({ apiKey: trimmed });
  process.stdout.write(
    `API key successfully saved to ${getConfigFile()} (mode 0600).\nYou no longer need to export $JEV_API_KEY or $TYPESAFE_API_KEY.\n`
  );
  return 0;
}

export function handleAuthStatus(): number {
  try {
    const key = resolveApiKey();
    const stored = loadStoredConfig();
    const dotEnv = loadDotEnv();

    let source = "unknown";
    if (process.env.TYPESAFE_API_KEY) source = "environment ($TYPESAFE_API_KEY)";
    else if (process.env.JEV_API_KEY) source = "environment ($JEV_API_KEY)";
    else if (dotEnv.TYPESAFE_API_KEY || dotEnv.JEV_API_KEY) source = "local .env file";
    else if (stored.apiKey) source = `stored config (${getConfigFile()})`;

    const masked =
      key.length > 12
        ? `${key.slice(0, 8)}...${key.slice(-4)}`
        : "***";

    process.stdout.write(`Authenticated: Yes\nKey: ${masked}\nSource: ${source}\n`);
    return 0;
  } catch {
    process.stdout.write(
      "Authenticated: No\nNo API key configured. Run 'jev auth set-key <key>' to save your key.\n"
    );
    return 1;
  }
}

export function handleAuthLogout(): number {
  saveStoredConfig({ apiKey: undefined });
  process.stdout.write(`Removed API key from ${getConfigFile()}.\n`);
  return 0;
}
