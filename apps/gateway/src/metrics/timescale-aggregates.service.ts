import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

export interface MetricAggregate {
  time_bucket: string;
  session_id: string;
  avg_wpm: number;
  avg_pitch: number;
  avg_volume: number;
  total_fillers: number;
  count: number;
}

export interface ContinuousAggregate {
  name: string;
  view_name: string;
  materialized: boolean;
  refresh_lag: string;
  max_interval_per_job: string;
}

@Injectable()
export class TimescaleAggregatesService {
  private readonly logger = new Logger(TimescaleAggregatesService.name);
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'ai_coaching',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  // Create continuous aggregates
  async createContinuousAggregates(): Promise<void> {
    try {
      // Create 1-minute aggregates
      await this.createMinuteAggregates();
      
      // Create 5-minute aggregates
      await this.createFiveMinuteAggregates();
      
      // Create hourly aggregates
      await this.createHourlyAggregates();
      
      // Create daily aggregates
      await this.createDailyAggregates();
      
      this.logger.log('Created all continuous aggregates');
    } catch (error) {
      this.logger.error('Failed to create continuous aggregates:', error);
      throw error;
    }
  }

  private async createMinuteAggregates(): Promise<void> {
    const query = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1min
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 minute', timestamp) AS time_bucket,
        session_id,
        AVG(wpm) AS avg_wpm,
        AVG(pitch) AS avg_pitch,
        AVG(volume) AS avg_volume,
        SUM(fillers) AS total_fillers,
        COUNT(*) AS count
      FROM metrics
      GROUP BY time_bucket, session_id
      WITH NO DATA;
    `;
    
    await this.pool.query(query);
    
    // Add refresh policy
    const refreshQuery = `
      SELECT add_continuous_aggregate_policy('metrics_1min',
        start_offset => INTERVAL '1 hour',
        end_offset => INTERVAL '1 minute',
        schedule_interval => INTERVAL '1 minute');
    `;
    
    await this.pool.query(refreshQuery);
  }

  private async createFiveMinuteAggregates(): Promise<void> {
    const query = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_5min
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('5 minutes', timestamp) AS time_bucket,
        session_id,
        AVG(wpm) AS avg_wpm,
        AVG(pitch) AS avg_pitch,
        AVG(volume) AS avg_volume,
        SUM(fillers) AS total_fillers,
        COUNT(*) AS count
      FROM metrics
      GROUP BY time_bucket, session_id
      WITH NO DATA;
    `;
    
    await this.pool.query(query);
    
    // Add refresh policy
    const refreshQuery = `
      SELECT add_continuous_aggregate_policy('metrics_5min',
        start_offset => INTERVAL '1 hour',
        end_offset => INTERVAL '5 minutes',
        schedule_interval => INTERVAL '5 minutes');
    `;
    
    await this.pool.query(refreshQuery);
  }

  private async createHourlyAggregates(): Promise<void> {
    const query = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1hour
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 hour', timestamp) AS time_bucket,
        session_id,
        AVG(wpm) AS avg_wpm,
        AVG(pitch) AS avg_pitch,
        AVG(volume) AS avg_volume,
        SUM(fillers) AS total_fillers,
        COUNT(*) AS count
      FROM metrics
      GROUP BY time_bucket, session_id
      WITH NO DATA;
    `;
    
    await this.pool.query(query);
    
    // Add refresh policy
    const refreshQuery = `
      SELECT add_continuous_aggregate_policy('metrics_1hour',
        start_offset => INTERVAL '3 hours',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour');
    `;
    
    await this.pool.query(refreshQuery);
  }

  private async createDailyAggregates(): Promise<void> {
    const query = `
      CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1day
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 day', timestamp) AS time_bucket,
        session_id,
        AVG(wpm) AS avg_wpm,
        AVG(pitch) AS avg_pitch,
        AVG(volume) AS avg_volume,
        SUM(fillers) AS total_fillers,
        COUNT(*) AS count
      FROM metrics
      GROUP BY time_bucket, session_id
      WITH NO DATA;
    `;
    
    await this.pool.query(query);
    
    // Add refresh policy
    const refreshQuery = `
      SELECT add_continuous_aggregate_policy('metrics_1day',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 day',
        schedule_interval => INTERVAL '1 day');
    `;
    
    await this.pool.query(refreshQuery);
  }

  // Query aggregates
  async getMinuteAggregates(sessionId: string, startTime: Date, endTime: Date): Promise<MetricAggregate[]> {
    const query = `
      SELECT * FROM metrics_1min
      WHERE session_id = $1
        AND time_bucket >= $2
        AND time_bucket <= $3
      ORDER BY time_bucket;
    `;
    
    const result = await this.pool.query(query, [sessionId, startTime, endTime]);
    return result.rows;
  }

  async getFiveMinuteAggregates(sessionId: string, startTime: Date, endTime: Date): Promise<MetricAggregate[]> {
    const query = `
      SELECT * FROM metrics_5min
      WHERE session_id = $1
        AND time_bucket >= $2
        AND time_bucket <= $3
      ORDER BY time_bucket;
    `;
    
    const result = await this.pool.query(query, [sessionId, startTime, endTime]);
    return result.rows;
  }

  async getHourlyAggregates(sessionId: string, startTime: Date, endTime: Date): Promise<MetricAggregate[]> {
    const query = `
      SELECT * FROM metrics_1hour
      WHERE session_id = $1
        AND time_bucket >= $2
        AND time_bucket <= $3
      ORDER BY time_bucket;
    `;
    
    const result = await this.pool.query(query, [sessionId, startTime, endTime]);
    return result.rows;
  }

  async getDailyAggregates(sessionId: string, startTime: Date, endTime: Date): Promise<MetricAggregate[]> {
    const query = `
      SELECT * FROM metrics_1day
      WHERE session_id = $1
        AND time_bucket >= $2
        AND time_bucket <= $3
      ORDER BY time_bucket;
    `;
    
    const result = await this.pool.query(query, [sessionId, startTime, endTime]);
    return result.rows;
  }

  // Get aggregate statistics
  async getAggregateStats(sessionId: string, timeRange: '1h' | '24h' | '7d' | '30d'): Promise<any> {
    try {
      const now = new Date();
      let startTime: Date;
      let aggregateView: string;
      
      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          aggregateView = 'metrics_1min';
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          aggregateView = 'metrics_5min';
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          aggregateView = 'metrics_1hour';
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          aggregateView = 'metrics_1day';
          break;
        default:
          throw new Error('Invalid time range');
      }
      
      const query = `
        SELECT
          AVG(avg_wpm) as avg_wpm,
          AVG(avg_pitch) as avg_pitch,
          AVG(avg_volume) as avg_volume,
          SUM(total_fillers) as total_fillers,
          SUM(count) as total_measurements,
          COUNT(*) as time_periods
        FROM ${aggregateView}
        WHERE session_id = $1
          AND time_bucket >= $2
          AND time_bucket <= $3
      `;
      
      const result = await this.pool.query(query, [sessionId, startTime, now]);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to get aggregate stats for session ${sessionId}:`, error);
      return null;
    }
  }

  // Get trends over time
  async getTrends(sessionId: string, metric: 'wpm' | 'pitch' | 'volume' | 'fillers', timeRange: '1h' | '24h' | '7d'): Promise<any[]> {
    try {
      const now = new Date();
      let startTime: Date;
      let aggregateView: string;
      let metricColumn: string;
      
      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          aggregateView = 'metrics_1min';
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          aggregateView = 'metrics_5min';
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          aggregateView = 'metrics_1hour';
          break;
        default:
          throw new Error('Invalid time range');
      }
      
      switch (metric) {
        case 'wpm':
          metricColumn = 'avg_wpm';
          break;
        case 'pitch':
          metricColumn = 'avg_pitch';
          break;
        case 'volume':
          metricColumn = 'avg_volume';
          break;
        case 'fillers':
          metricColumn = 'total_fillers';
          break;
        default:
          throw new Error('Invalid metric');
      }
      
      const query = `
        SELECT
          time_bucket,
          ${metricColumn} as value
        FROM ${aggregateView}
        WHERE session_id = $1
          AND time_bucket >= $2
          AND time_bucket <= $3
        ORDER BY time_bucket;
      `;
      
      const result = await this.pool.query(query, [sessionId, startTime, now]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get trends for session ${sessionId}:`, error);
      return [];
    }
  }

  // Get performance comparisons
  async getPerformanceComparison(sessionId: string, comparisonSessions: string[]): Promise<any> {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const allSessions = [sessionId, ...comparisonSessions];
      const placeholders = allSessions.map((_, i) => `$${i + 2}`).join(',');
      
      const query = `
        SELECT
          session_id,
          AVG(avg_wpm) as avg_wpm,
          AVG(avg_pitch) as avg_pitch,
          AVG(avg_volume) as avg_volume,
          SUM(total_fillers) as total_fillers,
          SUM(count) as total_measurements
        FROM metrics_5min
        WHERE session_id IN (${placeholders})
          AND time_bucket >= $1
          AND time_bucket <= $${allSessions.length + 2}
        GROUP BY session_id
        ORDER BY session_id;
      `;
      
      const result = await this.pool.query(query, [startTime, ...allSessions, now]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get performance comparison for session ${sessionId}:`, error);
      return [];
    }
  }

  // Refresh aggregates manually
  async refreshAggregates(aggregateName: string): Promise<void> {
    try {
      const query = `CALL refresh_continuous_aggregate($1, NULL, NULL);`;
      await this.pool.query(query, [aggregateName]);
      this.logger.debug(`Refreshed aggregate ${aggregateName}`);
    } catch (error) {
      this.logger.error(`Failed to refresh aggregate ${aggregateName}:`, error);
      throw error;
    }
  }

  // Get aggregate information
  async getAggregateInfo(): Promise<ContinuousAggregate[]> {
    try {
      const query = `
        SELECT
          view_name as name,
          view_name,
          materialized,
          refresh_lag,
          max_interval_per_job
        FROM timescaledb_information.continuous_aggregates
        WHERE view_name LIKE 'metrics_%'
        ORDER BY view_name;
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Failed to get aggregate info:', error);
      return [];
    }
  }

  // Drop aggregates
  async dropAggregates(): Promise<void> {
    try {
      const aggregates = ['metrics_1min', 'metrics_5min', 'metrics_1hour', 'metrics_1day'];
      
      for (const aggregate of aggregates) {
        const query = `DROP MATERIALIZED VIEW IF EXISTS ${aggregate} CASCADE;`;
        await this.pool.query(query);
      }
      
      this.logger.log('Dropped all continuous aggregates');
    } catch (error) {
      this.logger.error('Failed to drop aggregates:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const query = 'SELECT 1;';
      await this.pool.query(query);
      return true;
    } catch (error) {
      this.logger.error('TimescaleDB health check failed:', error);
      return false;
    }
  }

  onModuleDestroy() {
    this.pool.end();
  }
}
