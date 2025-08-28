import { Module } from '@nestjs/common';
import { EventCountersService } from './event-counters.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [EventCountersService],
  exports: [EventCountersService],
})
export class EventCountersModule {}
