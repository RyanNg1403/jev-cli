import { JevService } from "../client";
import { resolveModel, saveStoredConfig, getConfigFile } from "../config";
import type { CommonOptions } from "../types";

export async function handleModelsList(options: CommonOptions): Promise<number> {
  const service = new JevService({
    apiKey: options.apiKey,
    timeout: options.timeout ? Number(options.timeout) : undefined,
  });

  const models = await service.listModels();
  const currentDefault = resolveModel();

  if (options.json) {
    process.stdout.write(JSON.stringify(models, null, 2) + "\n");
    return 0;
  }

  process.stdout.write("  NAME            RELEASED        STATUS      DESCRIPTION\n");
  process.stdout.write("--------------------------------------------------------------------------------\n");

  for (const m of models) {
    const isDefault = m.name === currentDefault;
    const marker = isDefault ? "* " : "  ";
    const status = isDefault ? "ACTIVE" : "AVAILABLE";
    const name = m.name.padEnd(16, " ");
    const released = (m.release_date ? m.release_date.split("T")[0] : "-").padEnd(16, " ");
    const statusStr = status.padEnd(12, " ");
    process.stdout.write(`${marker}${name}${released}${statusStr}${m.description || ""}\n`);
  }

  process.stdout.write("\n(* marks the currently active default model)\n");
  return 0;
}

export function handleModelsSetDefault(modelName: string): number {
  if (!modelName) {
    process.stderr.write("Error: Model name is required. Usage: jev models set-default <name>\n");
    return 2;
  }

  saveStoredConfig({ defaultModel: modelName });
  process.stdout.write(
    `Default model set to '${modelName}' (saved in ${getConfigFile()}).\n`
  );
  return 0;
}
