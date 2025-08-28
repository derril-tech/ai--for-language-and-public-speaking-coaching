import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContentService } from './content.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // Clips endpoints
  @Post('sessions/:sessionId/clips')
  async createClip(
    @Param('sessionId') sessionId: string,
    @Body() createClipDto: { start_time: number; end_time: number; title?: string; description?: string },
  ) {
    return this.contentService.createClip(sessionId, createClipDto);
  }

  @Get('sessions/:sessionId/clips')
  async getClips(@Param('sessionId') sessionId: string) {
    return this.contentService.getClips(sessionId);
  }

  @Get('clips/:clipId')
  async getClip(@Param('clipId') clipId: string) {
    return this.contentService.getClip(clipId);
  }

  @Delete('clips/:clipId')
  async deleteClip(@Param('clipId') clipId: string) {
    return this.contentService.deleteClip(clipId);
  }

  // Reports endpoints
  @Post('sessions/:sessionId/reports')
  async createReport(
    @Param('sessionId') sessionId: string,
    @Body() createReportDto: { format: 'pdf' | 'csv' | 'json'; include_charts?: boolean },
  ) {
    return this.contentService.createReport(sessionId, createReportDto);
  }

  @Get('reports')
  async getReports(@Query('session_id') sessionId?: string) {
    return this.contentService.getReports(sessionId);
  }

  @Get('reports/:reportId')
  async getReport(@Param('reportId') reportId: string) {
    return this.contentService.getReport(reportId);
  }

  @Delete('reports/:reportId')
  async deleteReport(@Param('reportId') reportId: string) {
    return this.contentService.deleteReport(reportId);
  }

  // Comments endpoints
  @Post('sessions/:sessionId/comments')
  async createComment(
    @Param('sessionId') sessionId: string,
    @Body() createCommentDto: { text: string; timestamp?: number; type?: 'general' | 'improvement' | 'praise' },
  ) {
    return this.contentService.createComment(sessionId, createCommentDto);
  }

  @Get('sessions/:sessionId/comments')
  async getComments(@Param('sessionId') sessionId: string) {
    return this.contentService.getComments(sessionId);
  }

  @Put('comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: { text: string },
  ) {
    return this.contentService.updateComment(commentId, updateCommentDto);
  }

  @Delete('comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string) {
    return this.contentService.deleteComment(commentId);
  }

  // Shares endpoints
  @Post('sessions/:sessionId/shares')
  async createShare(
    @Param('sessionId') sessionId: string,
    @Body() createShareDto: { type: 'clip' | 'report' | 'session'; resource_id: string; expires_at?: string },
  ) {
    return this.contentService.createShare(sessionId, createShareDto);
  }

  @Get('shares')
  async getShares(@Query('session_id') sessionId?: string) {
    return this.contentService.getShares(sessionId);
  }

  @Get('shares/:shareId')
  async getShare(@Param('shareId') shareId: string) {
    return this.contentService.getShare(shareId);
  }

  @Delete('shares/:shareId')
  async deleteShare(@Param('shareId') shareId: string) {
    return this.contentService.deleteShare(shareId);
  }

  // Search endpoints
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('type') type?: 'sessions' | 'clips' | 'reports',
    @Query('session_id') sessionId?: string,
  ) {
    return this.contentService.search(query, type, sessionId);
  }

  @Get('search/suggestions')
  async getSearchSuggestions(@Query('q') query: string) {
    return this.contentService.getSearchSuggestions(query);
  }
}
