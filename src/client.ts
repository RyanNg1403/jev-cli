import { TypeSafeClient } from "@typesafe-ai/sdk";
import { resolveApiKey, resolveModel } from "./config";

export interface ClientOptions {
  apiKey?: string;
  model?: string;
  timeout?: number;
  retries?: number;
}

export class JevService {
  private client: TypeSafeClient;
  public model: string;

  constructor(options: ClientOptions = {}) {
    const apiKey = resolveApiKey(options.apiKey);
    this.model = resolveModel(options.model);

    this.client = new TypeSafeClient({
      apiKey,
      timeout: options.timeout ? options.timeout * 1000 : 10000,
      retry: {
        maxAttempts: options.retries ?? 3,
        initialDelayMs: 500,
        maxDelayMs: 8000,
        backoffFactor: 2,
      },
    });
  }

  async evaluate(state: any, questions: Record<string, any>) {
    try {
      const response = await this.client.systemOne({
        state,
        questions,
        model: this.model,
      });
      return response;
    } catch (err: any) {
      if (err.name === "AuthenticationError" || err.status === 401) {
        const error: any = new Error(`Authentication failed: Invalid API key.`);
        error.exitCode = 3;
        throw error;
      }
      if (err.name === "RateLimitError" || err.status === 429) {
        const error: any = new Error(`Rate limit exceeded. Try again shortly or increase retries.`);
        error.exitCode = 3;
        throw error;
      }
      if (err.name === "UnprocessableEntityError" || err.status === 422) {
        const error: any = new Error(`Unprocessable entity: ${err.message}`);
        error.exitCode = 2;
        throw error;
      }
      if (err.name === "APITimeoutError") {
        const error: any = new Error(`Request timed out after ${this.client.timeout}ms.`);
        error.exitCode = 3;
        throw error;
      }
      err.exitCode = 3;
      throw err;
    }
  }

  async listModels() {
    try {
      return await this.client.models.list();
    } catch (err: any) {
      err.exitCode = 3;
      throw err;
    }
  }
}
