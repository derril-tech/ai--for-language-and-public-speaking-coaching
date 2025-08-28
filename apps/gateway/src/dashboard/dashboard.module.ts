import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CacheModule } from '../cache/cache.module';
import { EventCountersModule } from '../event-counters/event-counters.module';
import { TimescaleAggregatesModule } from '../metrics/timescale-aggregates.module';
import { OpenTelemetryModule } from '../observability/opentelemetry.module';

@Module({
  imports: [
    CacheModule,
    EventCountersModule,
    TimescaleAggregatesModule,
    OpenTelemetryModule,
  ],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
