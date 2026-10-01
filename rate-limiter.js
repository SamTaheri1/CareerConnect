class AuthRateLimiter {
  constructor({ authMaxAttempts, authWindowMs }) {
    this.maxAttempts = authMaxAttempts;
    this.windowMs = authWindowMs;
    this.attempts = new Map();
  }

  check(key) {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    if (entry.count >= this.maxAttempts) {
      throw { status: 429, message: "Too many attempts. Please wait a few minutes and try again." };
    }
    entry.count += 1;
  }

  clear(key) { this.attempts.delete(key); }
}

module.exports = { AuthRateLimiter };
