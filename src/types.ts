export interface JevConfig {
  apiKey?: string;
  defaultModel?: string;
  timeout?: number;
  retries?: number;
}

export interface CommonOptions {
  model?: string;
  apiKey?: string;
  timeout?: string | number;
  retries?: string | number;
  jsonState?: string;
  json?: boolean;
  quiet?: boolean;
  tsv?: boolean;
  usage?: boolean;
  stream?: boolean;
  null?: boolean;
  threshold?: string | number;
  concurrency?: string | number;
}

export interface ChoiceOptions extends CommonOptions {
  choices?: string;
  criteria?: string;
  instruction?: string;
  i?: string;
}

export interface NoulOptions extends CommonOptions {
  instruction?: string;
  i?: string;
  criteria?: string;
  filter?: boolean;
  prob?: boolean;
}

export interface ScoreOptions extends CommonOptions {
  levels?: string;
  instruction?: string;
  i?: string;
  value?: boolean;
}

export interface EvalOptions extends CommonOptions {
  spec?: string;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}
