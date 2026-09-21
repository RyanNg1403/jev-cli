#!/usr/bin/env node
import cac from "cac";
import { handleChoice } from "./commands/choice";
import { handleNoul } from "./commands/noul";
import { handleScore } from "./commands/score";
import { handleEval } from "./commands/eval";
import { handleModelsList, handleModelsSetDefault } from "./commands/models";
import { handleAddSkill } from "./commands/add-skill";

// Handle POSIX signals gracefully
process.on("SIGINT", () => {
  process.exit(130);
});

process.stdout.on("error", (err: any) => {
  if (err.code === "EPIPE") {
    process.exit(0);
  }
});

const cli = cac("jev");

// Register Choice
cli
  .command("choice [...files]", "Select one option from discrete candidates")
  .option("-c, --choices <choices>", "Comma-separated list or JSON array of candidate IDs")
  .option("--criteria <criteria>", "JSON map of option IDs to detailed rubric descriptions")
  .option("-i, --instruction <instruction>", "Question, criteria, or instruction (text, JSON, or @file)")
  .option("--threshold <threshold>", "Minimum confidence threshold (0.0 to 1.0)", { default: 0.0 })
  .option("-q, --quiet", "Output only the winning choice ID")
  .option("--tsv", "Output tab-separated: winner, probability, confidence")
  .option("--json", "Output complete JSON payload")
  .option("--usage", "Output token metrics and estimated cost to stderr")
  .option("--stream", "Stream stdin line-by-line concurrently")
  .option("-z, --null", "Use null-byte delimiters for I/O")
  .option("--json-state <state>", "JSON state string or @file")
  .option("--model <model>", "Model identifier (overrides default)")
  .option("--api-key <key>", "TypeSafe API key")
  .option("--timeout <seconds>", "Request timeout in seconds")
  .option("--retries <retries>", "Retry attempts for HTTP 429/529")
  .option("--concurrency <limit>", "Concurrent request limit for streaming", { default: 10 })
  .action(async (files, options) => {
    try {
      const code = await handleChoice(files, options);
      process.exitCode = code;
    } catch (err: any) {
      process.stderr.write(`[jev error] ${err.message}\n`);
      process.exit(err.exitCode ?? 3);
    }
  });

// Register Noul
cli
  .command("noul [...files]", "Evaluate a boolean condition (Yes/No)")
  .option("-i, --instruction <instruction>", "Condition to evaluate (text, JSON, or @file)")
  .option("--criteria <criteria>", "JSON map defining true and false meanings")
  .option("--filter", "Semantic grep: pass through input if condition passes")
  .option("--threshold <threshold>", "Probability threshold", { default: 0.5 })
  .option("-q, --quiet", "Output only true or false")
  .option("--prob", "Output only raw probability number")
  .option("--json", "Output complete JSON payload")
  .option("--usage", "Output token metrics and estimated cost to stderr")
  .option("--stream", "Stream stdin line-by-line concurrently")
  .option("-z, --null", "Use null-byte delimiters for I/O")
  .option("--json-state <state>", "JSON state string or @file")
  .option("--model <model>", "Model identifier (overrides default)")
  .option("--api-key <key>", "TypeSafe API key")
  .option("--timeout <seconds>", "Request timeout in seconds")
  .option("--retries <retries>", "Retry attempts for HTTP 429/529")
  .option("--concurrency <limit>", "Concurrent request limit for streaming", { default: 10 })
  .action(async (files, options) => {
    try {
      const code = await handleNoul(files, options);
      process.exitCode = code;
    } catch (err: any) {
      process.stderr.write(`[jev error] ${err.message}\n`);
      process.exit(err.exitCode ?? 3);
    }
  });

// Register Score
cli
  .command("score [...files]", "Evaluate content along an ordered descriptive scale")
  .option("-l, --levels <levels>", "Comma-separated or JSON list of descriptive levels")
  .option("-i, --instruction <instruction>", "Grading rubric or criteria (text, JSON, or @file)")
  .option("-q, --quiet", "Output winning level label")
  .option("--value", "Output expected numerical score value")
  .option("--json", "Output complete JSON payload")
  .option("--usage", "Output token metrics and estimated cost to stderr")
  .option("--stream", "Stream stdin line-by-line concurrently")
  .option("-z, --null", "Use null-byte delimiters for I/O")
  .option("--json-state <state>", "JSON state string or @file")
  .option("--model <model>", "Model identifier (overrides default)")
  .option("--api-key <key>", "TypeSafe API key")
  .option("--timeout <seconds>", "Request timeout in seconds")
  .option("--retries <retries>", "Retry attempts for HTTP 429/529")
  .option("--concurrency <limit>", "Concurrent request limit for streaming", { default: 10 })
  .action(async (files, options) => {
    try {
      const code = await handleScore(files, options);
      process.exitCode = code;
    } catch (err: any) {
      process.stderr.write(`[jev error] ${err.message}\n`);
      process.exit(err.exitCode ?? 3);
    }
  });

// Register Eval
cli
  .command("eval [...files]", "Execute multiple orthogonal questions in one parallel pass")
  .option("-s, --spec <spec>", "JSON string or @file containing question definitions")
  .option("--json", "Output JSON dictionary of answers", { default: true })
  .option("--usage", "Output token metrics and estimated cost to stderr")
  .option("--stream", "Stream stdin line-by-line concurrently")
  .option("-z, --null", "Use null-byte delimiters for I/O")
  .option("--json-state <state>", "JSON state string or @file")
  .option("--model <model>", "Model identifier (overrides default)")
  .option("--api-key <key>", "TypeSafe API key")
  .option("--timeout <seconds>", "Request timeout in seconds")
  .option("--retries <retries>", "Retry attempts for HTTP 429/529")
  .option("--concurrency <limit>", "Concurrent request limit for streaming", { default: 10 })
  .action(async (files, options) => {
    try {
      const code = await handleEval(files, options);
      process.exitCode = code;
    } catch (err: any) {
      process.stderr.write(`[jev error] ${err.message}\n`);
      process.exit(err.exitCode ?? 3);
    }
  });

// Register Models
cli
  .command("models [action] [modelName]", "List available models or set local CLI default")
  .option("--json", "Output raw JSON")
  .option("--api-key <key>", "TypeSafe API key")
  .action(async (action, modelName, options) => {
    try {
      if (action === "set-default") {
        const code = handleModelsSetDefault(modelName);
        process.exitCode = code;
      } else {
        const code = await handleModelsList(options);
        process.exitCode = code;
      }
    } catch (err: any) {
      process.stderr.write(`[jev error] ${err.message}\n`);
      process.exit(err.exitCode ?? 3);
    }
  });

// Register Add-Skill
cli
  .command("add-skill [agent]", "Install jev skill into agent registries (antigravity, codex, claude, cursor, all)")
  .option("-d, --dir <dir>", "Custom directory to install the skill")
  .option("-g, --global", "Install to global user directory (~/...) instead of project workspace")
  .option("-f, --force", "Overwrite existing skill file if it already exists")
  .option("-q, --quiet", "Quiet output, print only target path")
  .action((agent, options) => {
    try {
      const code = handleAddSkill(agent, options);
      process.exitCode = code;
    } catch (err: any) {
      process.stderr.write(`[jev error] ${err.message}\n`);
      process.exit(2);
    }
  });

cli.help();
cli.version("0.1.0");

cli.parse();
