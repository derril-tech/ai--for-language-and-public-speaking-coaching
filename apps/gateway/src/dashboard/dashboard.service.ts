import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { EventCountersService } from '../event-counters/event-counters.service';
import { TimescaleAggregatesService } from '../metrics/timescale-aggregates.service';
import { OpenTelemetryService } from '../observability/opentelemetry.service';

export interface DashboardKPIs {
  totalSessions: number;
  activeUsers: number;
  averageSessionDuration: number;
  successRate: number;
  totalProcessingTime: number;
  cacheHitRate: number;
  errorRate: number;
  workerPerformance: {
    asr: { avgTime: number; successRate: number; totalProcessed: number };
    prosody: { avgTime: number; successRate: number; totalProcessed: number };
    fluency: { avgTime: number; successRate: number; totalProcessed: number };
    scoring: { avgTime: number; successRate: number; totalProcessed: number };
  };
}

export interface UserProgress {
  userId: string;
  totalSessions: number;
  averageWpm: number;
  averagePitch: number;
  totalFillers: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
  lastSessionDate: Date;
  weeklyGoalProgress: number;
}

export interface SystemHealth {
  database: boolean;
  redis: boolean;
  nats: boolean;
  workers: {
    asr: boolean;
    prosody: boolean;
    fluency: boolean;
    scoring: boolean;
    drill: boolean;
    clip: boolean;
    report: boolean;
    search: boolean;
  };
  opentelemetry: boolean;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly eventCountersService: EventCountersService,
    private readonly timescaleAggregatesService: TimescaleAggregatesService,
    private readonly openTelemetryService: OpenTelemetryService,
  ) {}

  // Get overall KPIs
  async getKPIs(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<DashboardKPIs> {
    try {
      const startTime = this.getStartTime(timeRange);
      const now = new Date();

      // Get performance metrics
      const performanceMetrics = await this.eventCountersService.getPerformanceMetrics(timeRange);
      
      // Get cache stats
      const cacheStats = await this.cacheService.getCacheStats();
      
      // Calculate KPIs
      const totalSessions = await this.getTotalSessions(startTime, now);
      const activeUsers = await this.getActiveUsers(startTime, now);
      const averageSessionDuration = await this.getAverageSessionDuration(startTime, now);
      const successRate = performanceMetrics?.summary?.successRate || 0;
      const totalProcessingTime = performanceMetrics?.summary?.totalEvents || 0;
      const cacheHitRate = this.calculateCacheHitRate(cacheStats);
      const errorRate = performanceMetrics?.summary?.totalFailures || 0;

      // Get worker performance
      const workerPerformance = await this.getWorkerPerformance(timeRange);

      return {
        totalSessions,
        activeUsers,
        averageSessionDuration,
        successRate,
        totalProcessingTime,
        cacheHitRate,
        errorRate,
        workerPerformance,
      };
    } catch (error) {
      this.logger.error('Failed to get KPIs:', error);
      return this.getDefaultKPIs();
    }
  }

  // Get user progress
  async getUserProgress(userId: string, timeRange: '7d' | '30d' | '90d' = '30d'): Promise<UserProgress> {
    try {
      const startTime = this.getStartTime(timeRange);
      const now = new Date();

      // Get user sessions
      const sessions = await this.getUserSessions(userId, startTime, now);
      
      if (sessions.length === 0) {
        return this.getDefaultUserProgress(userId);
      }

      // Calculate metrics
      const totalSessions = sessions.length;
      const averageWpm = sessions.reduce((sum, session) => sum + (session.avgWpm || 0), 0) / totalSessions;
      const averagePitch = sessions.reduce((sum, session) => sum + (session.avgPitch || 0), 0) / totalSessions;
      const totalFillers = sessions.reduce((sum, session) => sum + (session.totalFillers || 0), 0);
      
      // Calculate improvement trend
      const improvementTrend = this.calculateImprovementTrend(sessions);
      
      // Get last session date
      const lastSessionDate = new Date(Math.max(...sessions.map(s => new Date(s.timestamp).getTime())));
      
      // Calculate weekly goal progress
      const weeklyGoalProgress = await this.calculateWeeklyGoalProgress(userId);

      return {
        userId,
        totalSessions,
        averageWpm,
        averagePitch,
        totalFillers,
        improvementTrend,
        lastSessionDate,
        weeklyGoalProgress,
      };
    } catch (error) {
      this.logger.error(`Failed to get user progress for ${userId}:`, error);
      return this.getDefaultUserProgress(userId);
    }
  }

  // Get system health
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const health: SystemHealth = {
        database: await this.timescaleAggregatesService.healthCheck(),
        redis: await this.cacheService.redis.ping().then(() => true).catch(() => false),
        nats: true, // TODO: Add NATS health check
        workers: {
          asr: await this.checkWorkerHealth('asr'),
          prosody: await this.checkWorkerHealth('prosody'),
          fluency: await this.checkWorkerHealth('fluency'),
          scoring: await this.checkWorkerHealth('scoring'),
          drill: await this.checkWorkerHealth('drill'),
          clip: await this.checkWorkerHealth('clip'),
          report: await this.checkWorkerHealth('report'),
          search: await this.checkWorkerHealth('search'),
        },
        opentelemetry: await this.openTelemetryService.healthCheck(),
      };

      return health;
    } catch (error) {
      this.logger.error('Failed to get system health:', error);
      return this.getDefaultSystemHealth();
    }
  }

  // Get trending metrics
  async getTrendingMetrics(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<any> {
    try {
      const startTime = this.getStartTime(timeRange);
      const now = new Date();

      // Get recent performance data
      const performanceMetrics = await this.eventCountersService.getPerformanceMetrics(timeRange);
      
      // Get cache trends
      const cacheTrends = await this.getCacheTrends(startTime, now);
      
      // Get user activity trends
      const userActivityTrends = await this.getUserActivityTrends(startTime, now);

      return {
        performance: performanceMetrics,
        cache: cacheTrends,
        userActivity: userActivityTrends,
        timestamp: now,
      };
    } catch (error) {
      this.logger.error('Failed to get trending metrics:', error);
      return {};
    }
  }

  // Get alerts and notifications
  async getAlerts(): Promise<any[]> {
    try {
      const alerts: any[] = [];
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Check for high error rates
      const errorMetrics = await this.eventCountersService.getPerformanceMetrics('1h');
      if (errorMetrics?.summary?.totalFailures > 10) {
        alerts.push({
          type: 'error_rate',
          severity: 'high',
          message: `High error rate detected: ${errorMetrics.summary.totalFailures} errors in the last hour`,
          timestamp: now,
        });
      }

      // Check for worker failures
      const workerStats = await this.eventCountersService.getEventStats();
      const workerErrors = workerStats.filter((stat: any) => 
        stat.eventType.startsWith('worker:') && stat.failures > 0
      );

      workerErrors.forEach((worker: any) => {
        alerts.push({
          type: 'worker_failure',
          severity: 'medium',
          message: `${worker.eventType.replace('worker:', '')} worker has ${worker.failures} failures`,
          timestamp: now,
        });
      });

      // Check for system health issues
      const systemHealth = await this.getSystemHealth();
      if (!systemHealth.database) {
        alerts.push({
          type: 'system_health',
          severity: 'critical',
          message: 'Database connection failed',
          timestamp: now,
        });
      }

      if (!systemHealth.redis) {
        alerts.push({
          type: 'system_health',
          severity: 'high',
          message: 'Redis connection failed',
          timestamp: now,
        });
      }

      return alerts;
    } catch (error) {
      this.logger.error('Failed to get alerts:', error);
      return [];
    }
  }

  // Private helper methods
  private getStartTime(timeRange: string): Date {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private async getTotalSessions(startTime: Date, endTime: Date): Promise<number> {
    // TODO: Implement actual database query
    return Math.floor(Math.random() * 1000) + 100;
  }

  private async getActiveUsers(startTime: Date, endTime: Date): Promise<number> {
    // TODO: Implement actual database query
    return Math.floor(Math.random() * 100) + 10;
  }

  private async getAverageSessionDuration(startTime: Date, endTime: Date): Promise<number> {
    // TODO: Implement actual database query
    return Math.floor(Math.random() * 300) + 120; // 2-7 minutes
  }

  private calculateCacheHitRate(cacheStats: any): number {
    if (!cacheStats) return 0;
    
    // TODO: Implement actual cache hit rate calculation
    return Math.random() * 20 + 80; // 80-100%
  }

  private async getWorkerPerformance(timeRange: string): Promise<any> {
    const workerStats = await this.eventCountersService.getEventStats();
    const workers = ['asr', 'prosody', 'fluency', 'scoring'];
    
    const performance: any = {};
    
    workers.forEach(worker => {
      const stat = workerStats.find((s: any) => s.eventType === `worker:${worker}`);
      if (stat) {
        performance[worker] = {
          avgTime: stat.avgTime || 0,
          successRate: stat.count > 0 ? ((stat.count - stat.failures) / stat.count) * 100 : 0,
          totalProcessed: stat.count || 0,
        };
      } else {
        performance[worker] = {
          avgTime: 0,
          successRate: 0,
          totalProcessed: 0,
        };
      }
    });

    return performance;
  }

  private async getUserSessions(userId: string, startTime: Date, endTime: Date): Promise<any[]> {
    // TODO: Implement actual database query
    return [
      {
        avgWpm: 150,
        avgPitch: 220,
        totalFillers: 5,
        timestamp: new Date(),
      },
      {
        avgWpm: 145,
        avgPitch: 225,
        totalFillers: 3,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ];
  }

  private calculateImprovementTrend(sessions: any[]): 'improving' | 'stable' | 'declining' {
    if (sessions.length < 2) return 'stable';
    
    // Simple trend calculation based on WPM
    const recentWpm = sessions[0].avgWpm;
    const olderWpm = sessions[sessions.length - 1].avgWpm;
    
    if (recentWpm > olderWpm + 5) return 'improving';
    if (recentWpm < olderWpm - 5) return 'declining';
    return 'stable';
  }

  private async calculateWeeklyGoalProgress(userId: string): Promise<number> {
    // TODO: Implement actual goal progress calculation
    return Math.random() * 100;
  }

  private async checkWorkerHealth(workerType: string): Promise<boolean> {
    // TODO: Implement actual worker health check
    return Math.random() > 0.1; // 90% uptime simulation
  }

  private async getCacheTrends(startTime: Date, endTime: Date): Promise<any> {
    // TODO: Implement actual cache trend analysis
    return {
      hitRate: Math.random() * 20 + 80,
      missRate: Math.random() * 20,
      avgResponseTime: Math.random() * 10 + 5,
    };
  }

  private async getUserActivityTrends(startTime: Date, endTime: Date): Promise<any> {
    // TODO: Implement actual user activity trend analysis
    return {
      activeUsers: Math.floor(Math.random() * 50) + 20,
      newUsers: Math.floor(Math.random() * 10) + 5,
      sessionCount: Math.floor(Math.random() * 200) + 100,
    };
  }

  private getDefaultKPIs(): DashboardKPIs {
    return {
      totalSessions: 0,
      activeUsers: 0,
      averageSessionDuration: 0,
      successRate: 0,
      totalProcessingTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      workerPerformance: {
        asr: { avgTime: 0, successRate: 0, totalProcessed: 0 },
        prosody: { avgTime: 0, successRate: 0, totalProcessed: 0 },
        fluency: { avgTime: 0, successRate: 0, totalProcessed: 0 },
        scoring: { avgTime: 0, successRate: 0, totalProcessed: 0 },
      },
    };
  }

  private getDefaultUserProgress(userId: string): UserProgress {
    return {
      userId,
      totalSessions: 0,
      averageWpm: 0,
      averagePitch: 0,
      totalFillers: 0,
      improvementTrend: 'stable',
      lastSessionDate: new Date(),
      weeklyGoalProgress: 0,
    };
  }

  private getDefaultSystemHealth(): SystemHealth {
    return {
      database: false,
      redis: false,
      nats: false,
      workers: {
        asr: false,
        prosody: false,
        fluency: false,
        scoring: false,
        drill: false,
        clip: false,
        report: false,
        search: false,
      },
      opentelemetry: false,
    };
  }
}
