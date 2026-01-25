/**
 * Rate limiter for socket events
 * Prevents spam and DoS attacks with IP-based limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface ConnectionEntry {
  count: number;
  socketIds: Set<string>;
  blockedUntil: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 30, windowMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be allowed
   * @param key Unique identifier (e.g., socket.id or IP)
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      this.limits.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Remove entry for a key (e.g., on disconnect)
   */
  remove(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

/**
 * IP-based rate limiter with connection limits
 */
export class IPRateLimiter {
  private ipLimits: Map<string, RateLimitEntry> = new Map();
  private ipConnections: Map<string, ConnectionEntry> = new Map();
  private readonly maxRequestsPerSecond: number;
  private readonly maxConnectionsPerIP: number;
  private readonly blockDurationMs: number;

  constructor(
    maxRequestsPerSecond: number = 50,
    maxConnectionsPerIP: number = 5,
    blockDurationMs: number = 60000
  ) {
    this.maxRequestsPerSecond = maxRequestsPerSecond;
    this.maxConnectionsPerIP = maxConnectionsPerIP;
    this.blockDurationMs = blockDurationMs;

    // Cleanup every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if IP is allowed to make a request
   */
  isAllowed(ip: string): boolean {
    const now = Date.now();

    // Check if IP is blocked
    const connEntry = this.ipConnections.get(ip);
    if (connEntry && connEntry.blockedUntil > now) {
      return false;
    }

    // Check rate limit
    const entry = this.ipLimits.get(ip);
    if (!entry || now >= entry.resetAt) {
      this.ipLimits.set(ip, { count: 1, resetAt: now + 1000 });
      return true;
    }

    if (entry.count >= this.maxRequestsPerSecond) {
      // Block IP for repeated violations
      this.blockIP(ip);
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Register a new connection from an IP
   * @returns true if connection allowed, false if limit exceeded
   */
  registerConnection(ip: string, socketId: string): boolean {
    const now = Date.now();
    let entry = this.ipConnections.get(ip);

    // Check if IP is blocked
    if (entry && entry.blockedUntil > now) {
      console.log(`[IPRateLimiter] Blocked IP ${this.maskIP(ip)} attempted connection`);
      return false;
    }

    if (!entry) {
      entry = { count: 0, socketIds: new Set(), blockedUntil: 0 };
      this.ipConnections.set(ip, entry);
    }

    // Check connection limit
    if (entry.socketIds.size >= this.maxConnectionsPerIP) {
      console.log(
        `[IPRateLimiter] IP ${this.maskIP(ip)} exceeded max connections (${this.maxConnectionsPerIP})`
      );
      this.blockIP(ip);
      return false;
    }

    entry.socketIds.add(socketId);
    entry.count = entry.socketIds.size;
    return true;
  }

  /**
   * Unregister a connection when socket disconnects
   */
  unregisterConnection(ip: string, socketId: string): void {
    const entry = this.ipConnections.get(ip);
    if (entry) {
      entry.socketIds.delete(socketId);
      entry.count = entry.socketIds.size;

      // Cleanup if no more connections
      if (entry.socketIds.size === 0 && entry.blockedUntil <= Date.now()) {
        this.ipConnections.delete(ip);
      }
    }
  }

  /**
   * Block an IP for a duration
   */
  blockIP(ip: string): void {
    let entry = this.ipConnections.get(ip);
    if (!entry) {
      entry = { count: 0, socketIds: new Set(), blockedUntil: 0 };
      this.ipConnections.set(ip, entry);
    }
    entry.blockedUntil = Date.now() + this.blockDurationMs;
    console.log(
      `[IPRateLimiter] Blocked IP ${this.maskIP(ip)} for ${this.blockDurationMs / 1000}s`
    );
  }

  /**
   * Check if IP is currently blocked
   */
  isBlocked(ip: string): boolean {
    const entry = this.ipConnections.get(ip);
    return entry ? entry.blockedUntil > Date.now() : false;
  }

  /**
   * Get connection count for an IP
   */
  getConnectionCount(ip: string): number {
    const entry = this.ipConnections.get(ip);
    return entry ? entry.socketIds.size : 0;
  }

  /**
   * Mask IP for logging (privacy)
   */
  private maskIP(ip: string): string {
    if (ip.includes(':')) {
      // IPv6 - show first 4 segments
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + ':****';
    }
    // IPv4 - show first 2 octets
    const parts = ip.split('.');
    return parts.slice(0, 2).join('.') + '.***';
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();

    // Cleanup rate limits
    for (const [key, entry] of this.ipLimits) {
      if (now >= entry.resetAt) {
        this.ipLimits.delete(key);
      }
    }

    // Cleanup connection entries with no active connections and not blocked
    for (const [ip, entry] of this.ipConnections) {
      if (entry.socketIds.size === 0 && entry.blockedUntil <= now) {
        this.ipConnections.delete(ip);
      }
    }
  }

  /**
   * Get stats for monitoring
   */
  getStats(): { totalIPs: number; blockedIPs: number; totalConnections: number } {
    const now = Date.now();
    let blockedIPs = 0;
    let totalConnections = 0;

    for (const entry of this.ipConnections.values()) {
      if (entry.blockedUntil > now) blockedIPs++;
      totalConnections += entry.socketIds.size;
    }

    return {
      totalIPs: this.ipConnections.size,
      blockedIPs,
      totalConnections,
    };
  }
}

// Action-specific rate limiter (stricter for game actions)
export class ActionRateLimiter {
  private actionLimiter: RateLimiter;
  private generalLimiter: RateLimiter;
  private ipLimiter: IPRateLimiter;

  constructor() {
    // Max 10 game actions per second (fold, call, raise, etc.)
    this.actionLimiter = new RateLimiter(10, 1000);
    // Max 30 general requests per second (get-tables, etc.)
    this.generalLimiter = new RateLimiter(30, 1000);
    // IP-based: 50 requests/sec, max 5 connections per IP, 60s block
    this.ipLimiter = new IPRateLimiter(50, 5, 60000);
  }

  isActionAllowed(socketId: string, ip?: string): boolean {
    // Check IP limit first if provided
    if (ip && !this.ipLimiter.isAllowed(ip)) {
      return false;
    }
    return this.actionLimiter.isAllowed(`action:${socketId}`);
  }

  isGeneralAllowed(socketId: string, ip?: string): boolean {
    // Check IP limit first if provided
    if (ip && !this.ipLimiter.isAllowed(ip)) {
      return false;
    }
    return this.generalLimiter.isAllowed(`general:${socketId}`);
  }

  /**
   * Register new connection
   */
  registerConnection(ip: string, socketId: string): boolean {
    return this.ipLimiter.registerConnection(ip, socketId);
  }

  /**
   * Unregister connection on disconnect
   */
  unregisterConnection(ip: string, socketId: string): void {
    this.ipLimiter.unregisterConnection(ip, socketId);
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.ipLimiter.isBlocked(ip);
  }

  remove(socketId: string): void {
    this.actionLimiter.remove(`action:${socketId}`);
    this.generalLimiter.remove(`general:${socketId}`);
  }

  /**
   * Get IP limiter stats
   */
  getIPStats() {
    return this.ipLimiter.getStats();
  }
}
