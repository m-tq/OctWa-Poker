/**
 * Security logging utility
 * Logs suspicious activities for monitoring
 */

import { hashData } from './security.js';

export enum SecurityEventType {
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED_ACTION = 'UNAUTHORIZED_ACTION',
  SUSPICIOUS_TIMING = 'SUSPICIOUS_TIMING',
  MULTI_TABLE_ATTEMPT = 'MULTI_TABLE_ATTEMPT',
  VIOLATION_BLOCKED = 'VIOLATION_BLOCKED',
  INVALID_BET = 'INVALID_BET',
}

interface SecurityEvent {
  type: SecurityEventType;
  socketId: string;
  address?: string;
  details?: string;
  timestamp: Date;
}

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 10000;

  log(type: SecurityEventType, socketId: string, address?: string, details?: string): void {
    const event: SecurityEvent = {
      type,
      socketId: hashData(socketId), // Hash for privacy
      address: address ? hashData(address) : undefined,
      details,
      timestamp: new Date(),
    };

    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents / 2);
    }

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Security] ${type}`, {
        socketId: event.socketId,
        address: event.address,
        details,
        time: event.timestamp.toISOString(),
      });
    }
  }

  /**
   * Get recent events for monitoring
   */
  getRecentEvents(count = 100): SecurityEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: SecurityEventType, count = 100): SecurityEvent[] {
    return this.events
      .filter(e => e.type === type)
      .slice(-count);
  }

  /**
   * Get event count by type in last N minutes
   */
  getEventCountByType(type: SecurityEventType, minutes = 60): number {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.events.filter(
      e => e.type === type && e.timestamp.getTime() > cutoff
    ).length;
  }
}

export const securityLogger = new SecurityLogger();
