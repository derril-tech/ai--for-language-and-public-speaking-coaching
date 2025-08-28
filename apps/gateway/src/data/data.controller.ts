import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DataService } from './data.service';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class DataController {
  constructor(private readonly dataService: DataService) {}

  @Get(':sessionId/transcript')
  async getTranscript(@Param('sessionId') sessionId: string) {
    return this.dataService.getTranscript(sessionId);
  }

  @Get(':sessionId/metrics')
  async getMetrics(
    @Param('sessionId') sessionId: string,
    @Query('keys') keys?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.dataService.getMetrics(sessionId, keys?.split(','), start, end);
  }

  @Get(':sessionId/scores')
  async getScores(@Param('sessionId') sessionId: string) {
    return this.dataService.getScores(sessionId);
  }

  @Get(':sessionId/fluency')
  async getFluency(@Param('sessionId') sessionId: string) {
    return this.dataService.getFluency(sessionId);
  }

  @Get(':sessionId/drills')
  async getDrills(@Param('sessionId') sessionId: string) {
    return this.dataService.getDrills(sessionId);
  }
}
