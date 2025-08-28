import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

export interface EventCounter {
  eventType: string;
  count: number;
  totalTime: number;
  avgTime: number;
  failures: number;
  lastOccurrence: number;
  firstOccurrence: number;
}

export interface ProcessingMetrics {
  sessionId: string;
  workerType: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
}

@Injectable()
export class EventCountersService {
  private readonly logger = new Logger(EventCountersService.name);

  constructor(private readonly cacheService: CacheService) {}

  // Track processing events
  async trackProcessingStart(sessionId: string, workerType: string): Promise<string> {
    const processingId = `${sessionId}:${workerType}:${Date.now()}`;
    const metrics: ProcessingMetrics = {
      sessionId,
      workerType,
      startTime: Date.now(),
      status: 'processing',
    };

    await this.cacheService.set(`processing:${processingId}`, metrics, 3600);
    this.logger.debug(`Started tracking processing for ${processingId}`);
    return processingId;
  }

  async trackProcessingComplete(processingId: string): Promise<void> {
    try {
      const metrics = await this.cacheService.get(`processing:${processingId}`) as ProcessingMetrics;
      if (metrics) {
        const endTime = Date.now();
        const duration = endTime - metrics.startTime;
        
        const updatedMetrics: ProcessingMetrics = {
          ...metrics,
          endTime,
          duration,
          status: 'completed',
        };

        await this.cacheService.set(`processing:${processingId}`, updatedMetrics, 3600);
        await this.updateEventCounter(metrics.workerType, duration, false);
        
        this.logger.debug(`Completed processing ${processingId} in ${duration}ms`);
      }
    } catch (error) {
      this.logger.error(`Failed to track processing completion for ${processingId}:`, error);
    }
  }

  async trackProcessingFailure(processingId: string, error: string): Promise<void> {
    try {
      const metrics = await this.cacheService.get(`processing:${processingId}`) as ProcessingMetrics;
      if (metrics) {
        const endTime = Date.now();
        const duration = endTime - metrics.startTime;
        
        const updatedMetrics: ProcessingMetrics = {
          ...metrics,
          endTime,
          duration,
          status: 'failed',
          error,
        };

        await this.cacheService.set(`processing:${processingId}`, updatedMetrics, 3600);
        await this.updateEventCounter(metrics.workerType, duration, true);
        
        this.logger.error(`Failed processing ${processingId} after ${duration}ms: ${error}`);
      }
    } catch (err) {
      this.logger.error(`Failed to track processing failure for ${processingId}:`, err);
    }
  }

  // Update event counters
  private async updateEventCounter(eventType: string, duration: number, isFailure: boolean): Promise<void> {
    try {
      const key = `event-counter:${eventType}`;
      const existing = await this.cacheService.get(key) as EventCounter | null;
      
      const now = Date.now();
      const newCounter: EventCounter = {
        eventType,
        count: (existing?.count || 0) + 1,
        totalTime: (existing?.totalTime || 0) + duration,
        avgTime: ((existing?.totalTime || 0) + duration) / ((existing?.count || 0) + 1),
        failures: (existing?.failures || 0) + (isFailure ? 1 : 0),
        lastOccurrence: now,
        firstOccurrence: existing?.firstOccurrence || now,
      };

      await this.cacheService.set(key, newCounter, 86400); // 24 hours TTL
    } catch (error) {
      this.logger.error(`Failed to update event counter for ${eventType}:`, error);
    }
  }

  // Get event statistics
  async getEventStats(eventType?: string): Promise<EventCounter | EventCounter[]> {
    try {
      if (eventType) {
        const key = `event-counter:${eventType}`;
        return await this.cacheService.get(key) as EventCounter;
      } else {
        // Get all event counters
        const pattern = 'event-counter:*';
        const keys = await this.cacheService.redis.keys(pattern);
        
        if (keys.length === 0) return [];

        const pipeline = this.cacheService.redis.pipeline();
        keys.forEach(key => pipeline.get(key));
        
        const results = await pipeline.exec();
        return results
          .map(([err, result]) => err ? null : JSON.parse(result as string))
          .filter(Boolean);
      }
    } catch (error) {
      this.logger.error('Failed to get event stats:', error);
      return eventType ? null : [];
    }
  }

  // Track specific events
  async trackEvent(eventType: string, metadata?: any): Promise<void> {
    try {
      const key = `event:${eventType}:${Date.now()}`;
      const eventData = {
        eventType,
        timestamp: Date.now(),
        metadata: metadata || {},
      };

      await this.cacheService.set(key, eventData, 3600);
      await this.updateEventCounter(eventType, 0, false);
    } catch (error) {
      this.logger.error(`Failed to track event ${eventType}:`, error);
    }
  }

  // Track API requests
  async trackApiRequest(endpoint: string, method: string, duration: number, statusCode: number): Promise<void> {
    try {
      const eventType = `api:${method}:${endpoint}`;
      const isFailure = statusCode >= 400;
      
      await this.updateEventCounter(eventType, duration, isFailure);
      
      // Track response times by status code
      const statusKey = `api:status:${statusCode}`;
      const statusCounter = await this.cacheService.get(statusKey) as EventCounter | null;
      
      const updatedStatusCounter: EventCounter = {
        eventType: statusKey,
        count: (statusCounter?.count || 0) + 1,
        totalTime: (statusCounter?.totalTime || 0) + duration,
        avgTime: ((statusCounter?.totalTime || 0) + duration) / ((statusCounter?.count || 0) + 1),
        failures: (statusCounter?.failures || 0) + (isFailure ? 1 : 0),
        lastOccurrence: Date.now(),
        firstOccurrence: statusCounter?.firstOccurrence || Date.now(),
      };

      await this.cacheService.set(statusKey, updatedStatusCounter, 86400);
    } catch (error) {
      this.logger.error('Failed to track API request:', error);
    }
  }

  // Track worker performance
  async trackWorkerPerformance(workerType: string, sessionId: string, duration: number, success: boolean): Promise<void> {
    try {
      const eventType = `worker:${workerType}`;
      await this.updateEventCounter(eventType, duration, !success);
      
      // Track per-session worker performance
      const sessionKey = `worker:session:${sessionId}`;
      const sessionData = await this.cacheService.get(sessionKey) || {};
      
      if (!sessionData[workerType]) {
        sessionData[workerType] = {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          failures: 0,
        };
      }
      
      sessionData[workerType].count++;
      sessionData[workerType].totalTime += duration;
      sessionData[workerType].avgTime = sessionData[workerType].totalTime / sessionData[workerType].count;
      if (!success) sessionData[workerType].failures++;
      
      await this.cacheService.set(sessionKey, sessionData, 3600);
    } catch (error) {
      this.logger.error(`Failed to track worker performance for ${workerType}:`, error);
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<any> {
    try {
      const now = Date.now();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      
      const cutoff = now - ranges[timeRange];
      
      // Get all event counters
      const eventCounters = await this.getEventStats() as EventCounter[];
      const filteredCounters = eventCounters.filter(counter => counter.lastOccurrence >= cutoff);
      
      // Calculate summary statistics
      const summary = {
        totalEvents: filteredCounters.reduce((sum, counter) => sum + counter.count, 0),
        totalFailures: filteredCounters.reduce((sum, counter) => sum + counter.failures, 0),
        avgProcessingTime: filteredCounters.reduce((sum, counter) => sum + counter.avgTime, 0) / filteredCounters.length || 0,
        successRate: 0,
        topWorkers: [] as any[],
        topEndpoints: [] as any[],
      };
      
      if (summary.totalEvents > 0) {
        summary.successRate = ((summary.totalEvents - summary.totalFailures) / summary.totalEvents) * 100;
      }
      
      // Get top performers
      const workerCounters = filteredCounters.filter(counter => counter.eventType.startsWith('worker:'));
      const apiCounters = filteredCounters.filter(counter => counter.eventType.startsWith('api:'));
      
      summary.topWorkers = workerCounters
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(counter => ({
          worker: counter.eventType.replace('worker:', ''),
          count: counter.count,
          avgTime: counter.avgTime,
          successRate: ((counter.count - counter.failures) / counter.count) * 100,
        }));
      
      summary.topEndpoints = apiCounters
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(counter => ({
          endpoint: counter.eventType.replace('api:', ''),
          count: counter.count,
          avgTime: counter.avgTime,
          successRate: ((counter.count - counter.failures) / counter.count) * 100,
        }));
      
      return {
        timeRange,
        summary,
        details: filteredCounters,
      };
    } catch (error) {
      this.logger.error('Failed to get performance metrics:', error);
      return null;
    }
  }

  // Cleanup old data
  async cleanupOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cutoff = Date.now() - maxAge;
      
      // Clean up old processing records
      const processingKeys = await this.cacheService.redis.keys('processing:*');
      for (const key of processingKeys) {
        const data = await this.cacheService.get(key) as ProcessingMetrics;
        if (data && data.startTime < cutoff) {
          await this.cacheService.delete(key);
        }
      }
      
      // Clean up old event records
      const eventKeys = await this.cacheService.redis.keys('event:*');
      for (const key of eventKeys) {
        const data = await this.cacheService.get(key);
        if (data && data.timestamp < cutoff) {
          await this.cacheService.delete(key);
        }
      }
      
      this.logger.debug('Cleaned up old event data');
    } catch (error) {
      this.logger.error('Failed to cleanup old data:', error);
    }
  }
}
