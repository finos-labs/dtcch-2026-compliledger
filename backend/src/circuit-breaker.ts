import { logger } from "./logger";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  callTimeoutMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private lastFailureTime: number | null = null;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly callTimeoutMs: number;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.callTimeoutMs = opts.callTimeoutMs ?? 8_000;
  }

  private isOpen(): boolean {
    return (this.state as string) === "OPEN";
  }

  async fire<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0);
      if (elapsed > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        logger.info({ circuit: this.name }, "Circuit breaker moving to HALF_OPEN");
      } else if (fallback) {
        logger.warn({ circuit: this.name }, "Circuit OPEN — using fallback");
        return fallback();
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.name}`);
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${this.name} call timed out after ${this.callTimeoutMs}ms`)), this.callTimeoutMs)
    );

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err as Error);
      if (fallback) {
        logger.warn({ circuit: this.name, open: this.isOpen() }, "Primary call failed — using fallback");
        return fallback();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      logger.info({ circuit: this.name }, "Circuit breaker CLOSED after successful probe");
    }
    this.state = "CLOSED";
    this.failures = 0;
  }

  private onFailure(err: Error): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    logger.warn({ circuit: this.name, failures: this.failures, err: err.message }, "Circuit breaker recorded failure");

    if (this.failures >= this.failureThreshold) {
      const wasAlreadyOpen = this.state === ("OPEN" as CircuitState);
      this.state = "OPEN";
      if (!wasAlreadyOpen) {
        logger.error({ circuit: this.name }, "Circuit breaker OPENED");
      }
    }
  }

  getState(): { state: CircuitState; failures: number } {
    return { state: this.state, failures: this.failures };
  }
}

export const cantonCircuit = new CircuitBreaker({
  name: "canton-api",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  callTimeoutMs: 10_000,
});

export const bedrockCircuit = new CircuitBreaker({
  name: "bedrock-api",
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  callTimeoutMs: 15_000,
});

export const gleifCircuit = new CircuitBreaker({
  name: "gleif-api",
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  callTimeoutMs: 8_000,
});

export const sanctionsCircuit = new CircuitBreaker({
  name: "sanctions-api",
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
  callTimeoutMs: 10_000,
});
