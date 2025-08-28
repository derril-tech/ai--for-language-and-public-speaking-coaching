import { Module } from '@nestjs/common';
import { OpenTelemetryService } from './opentelemetry.service';

@Module({
  providers: [OpenTelemetryService],
  exports: [OpenTelemetryService],
})
export class OpenTelemetryModule {}
