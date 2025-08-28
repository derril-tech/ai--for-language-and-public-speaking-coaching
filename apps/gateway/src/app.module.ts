import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { DataModule } from './data/data.module';
import { ContentModule } from './content/content.module';
import { WebSocketModule } from './websocket/websocket.module';
import { CacheModule } from './cache/cache.module';
import { EventCountersModule } from './event-counters/event-counters.module';
import { TimescaleAggregatesModule } from './metrics/timescale-aggregates.module';
import { OpenTelemetryModule } from './observability/opentelemetry.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UsersController, OrganizationsController } from './users/users.controller';
import { SessionsController } from './sessions/sessions.controller';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
    DataModule,
    ContentModule,
    WebSocketModule,
    CacheModule,
    EventCountersModule,
    TimescaleAggregatesModule,
    OpenTelemetryModule,
    DashboardModule,
  ],
  controllers: [
    UsersController,
    OrganizationsController,
    SessionsController,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
