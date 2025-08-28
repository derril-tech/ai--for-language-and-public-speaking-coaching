import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface CacheConfig {
  host: string;
  port: number;
  db: number;
  password?: string;
  keyPrefix: string;
  ttl: number;
}

export interface MetricsCache {
  sessionId: string;
  wpm: number;
  pitch: number;
  volume: number;
  fillers: number;
  timestamp: number;
}

export interface ScriptCache {
  sessionId: string;
  text: string;
  segments: any[];
  language: string;
  timestamp: number;
}

export interface VoiceProfileCache {
  userId: string;
  avgPitch: number;
  avgWpm: number;
  commonFillers: string[];
  speechPatterns: any;
  lastUpdated: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '0'),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'ai-coaching:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  // Metrics caching
  async cacheMetrics(sessionId: string, metrics: Partial<MetricsCache>): Promise<void> {
    try {
      const key = `metrics:${sessionId}`;
      const data: MetricsCache = {
        sessionId,
        wpm: metrics.wpm || 0,
        pitch: metrics.pitch || 0,
        volume: metrics.volume || 0,
        fillers: metrics.fillers || 0,
        timestamp: Date.now(),
      };

      await this.redis.setex(key, 3600, JSON.stringify(data)); // 1 hour TTL
      this.logger.debug(`Cached metrics for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to cache metrics for session ${sessionId}:`, error);
    }
  }

  async getMetrics(sessionId: string): Promise<MetricsCache | null> {
    try {
      const key = `metrics:${sessionId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get metrics for session ${sessionId}:`, error);
      return null;
    }
  }

  async getRecentMetrics(sessionId: string, limit: number = 10): Promise<MetricsCache[]> {
    try {
      const pattern = `metrics:${sessionId}:*`;
      const keys = await this.redis.keys(pattern);
      const sortedKeys = keys.sort().slice(-limit);
      
      if (sortedKeys.length === 0) return [];

      const pipeline = this.redis.pipeline();
      sortedKeys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      return results
        .map(([err, result]) => err ? null : JSON.parse(result as string))
        .filter(Boolean);
    } catch (error) {
      this.logger.error(`Failed to get recent metrics for session ${sessionId}:`, error);
      return [];
    }
  }

  // Script text caching
  async cacheScript(sessionId: string, script: Partial<ScriptCache>): Promise<void> {
    try {
      const key = `script:${sessionId}`;
      const data: ScriptCache = {
        sessionId,
        text: script.text || '',
        segments: script.segments || [],
        language: script.language || 'en',
        timestamp: Date.now(),
      };

      await this.redis.setex(key, 7200, JSON.stringify(data)); // 2 hours TTL
      this.logger.debug(`Cached script for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to cache script for session ${sessionId}:`, error);
    }
  }

  async getScript(sessionId: string): Promise<ScriptCache | null> {
    try {
      const key = `script:${sessionId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get script for session ${sessionId}:`, error);
      return null;
    }
  }

  // Voice profile caching
  async cacheVoiceProfile(userId: string, profile: Partial<VoiceProfileCache>): Promise<void> {
    try {
      const key = `voice-profile:${userId}`;
      const data: VoiceProfileCache = {
        userId,
        avgPitch: profile.avgPitch || 0,
        avgWpm: profile.avgWpm || 0,
        commonFillers: profile.commonFillers || [],
        speechPatterns: profile.speechPatterns || {},
        lastUpdated: Date.now(),
      };

      await this.redis.setex(key, 86400, JSON.stringify(data)); // 24 hours TTL
      this.logger.debug(`Cached voice profile for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to cache voice profile for user ${userId}:`, error);
    }
  }

  async getVoiceProfile(userId: string): Promise<VoiceProfileCache | null> {
    try {
      const key = `voice-profile:${userId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get voice profile for user ${userId}:`, error);
      return null;
    }
  }

  // Session data caching
  async cacheSessionData(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await this.redis.setex(key, ttl, JSON.stringify(data));
      this.logger.debug(`Cached session data for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to cache session data for session ${sessionId}:`, error);
    }
  }

  async getSessionData(sessionId: string): Promise<any | null> {
    try {
      const key = `session:${sessionId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get session data for session ${sessionId}:`, error);
      return null;
    }
  }

  // Generic caching methods
  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}:`, error);
    }
  }

  async get(key: string): Promise<any | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug(`Deleted cache key ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of cache key ${key}:`, error);
      return false;
    }
  }

  // Cache warming and maintenance
  async warmCache(sessionId: string): Promise<void> {
    try {
      // Pre-load common session data
      const sessionData = await this.getSessionData(sessionId);
      if (sessionData) {
        // Cache related data
        if (sessionData.metrics) {
          await this.cacheMetrics(sessionId, sessionData.metrics);
        }
        if (sessionData.script) {
          await this.cacheScript(sessionId, sessionData.script);
        }
      }
      this.logger.debug(`Warmed cache for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to warm cache for session ${sessionId}:`, error);
    }
  }

  async clearSessionCache(sessionId: string): Promise<void> {
    try {
      const pattern = `*:${sessionId}`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Cleared cache for session ${sessionId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to clear cache for session ${sessionId}:`, error);
    }
  }

  async getCacheStats(): Promise<any> {
    try {
      const info = await this.redis.info();
      const keys = await this.redis.dbsize();
      return {
        keys,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) acc[key] = value;
          return acc;
        }, {}),
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return null;
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
