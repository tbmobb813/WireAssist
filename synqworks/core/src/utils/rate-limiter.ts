// Rate limiting utility
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter(timestamp => now - timestamp < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false; // Rate limit exceeded
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return true;
  }

  async waitForSlot(key: string): Promise<void> {
    while (!(await this.checkLimit(key))) {
      // Wait for oldest request to expire
      const timestamps = this.requests.get(key) || [];
      const oldestTimestamp = timestamps[0];
      const waitTime = this.windowMs - (Date.now() - oldestTimestamp);

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      }
    }
  }

  clear(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(timestamp => now - timestamp < this.windowMs);

    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  getResetTime(key: string): number {
    const timestamps = this.requests.get(key) || [];
    if (timestamps.length === 0) {
      return Date.now();
    }

    return timestamps[0] + this.windowMs;
  }
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(capacity: number = 10, refillRate: number = 1) {
    this.capacity = capacity;
    this.refillRate = refillRate; // tokens per second
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async consume(tokens: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  async waitForTokens(tokens: number = 1): Promise<void> {
    while (!(await this.consume(tokens))) {
      const tokensNeeded = tokens - this.tokens;
      const waitTime = (tokensNeeded / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
    }
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
