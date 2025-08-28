import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export interface Session {
  id: string;
  project_id: string;
  user_id: string;
  title?: string;
  duration_seconds?: number;
  audio_url?: string;
  status: 'processing' | 'completed' | 'failed';
  metadata: Record<string, any>;
  created_at: string;
}

export interface CreateSessionDto {
  title: string;
  metadata?: Record<string, any>;
}

export interface UploadUrlDto {
  filename: string;
  content_type: string;
}

export interface UploadUrlResponse {
  upload_url: string;
  expires_in: number;
}

@Controller('projects/:projectId/sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  @Get()
  async getSessions(@Param('projectId') projectId: string): Promise<{ sessions: Session[] }> {
    // TODO: Replace with actual database query
    // For MVP, return demo data
    const sessions: Session[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440030',
        project_id: projectId,
        user_id: '550e8400-e29b-41d4-a716-446655440012',
        title: 'First Practice Session',
        duration_seconds: 180,
        audio_url: 'https://demo-bucket.s3.amazonaws.com/session-1.wav',
        status: 'completed',
        metadata: { recording_device: 'web', audio_quality: 'good' },
        created_at: new Date().toISOString(),
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440031',
        project_id: projectId,
        user_id: '550e8400-e29b-41d4-a716-446655440012',
        title: 'Week 2 Progress',
        duration_seconds: 240,
        audio_url: 'https://demo-bucket.s3.amazonaws.com/session-2.wav',
        status: 'completed',
        metadata: { recording_device: 'web', audio_quality: 'excellent' },
        created_at: new Date().toISOString(),
      },
    ];

    return { sessions };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Param('projectId') projectId: string,
    @Body() createSessionDto: CreateSessionDto,
    @Request() req,
  ): Promise<Session> {
    // TODO: Replace with actual database insert
    const session: Session = {
      id: `session-${Date.now()}`,
      project_id: projectId,
      user_id: req.user.userId,
      title: createSessionDto.title,
      status: 'processing',
      metadata: createSessionDto.metadata || {},
      created_at: new Date().toISOString(),
    };

    return session;
  }

  @Get(':sessionId')
  async getSession(@Param('sessionId') sessionId: string): Promise<Session> {
    // TODO: Replace with actual database query
    const session: Session = {
      id: sessionId,
      project_id: '550e8400-e29b-41d4-a716-446655440020',
      user_id: '550e8400-e29b-41d4-a716-446655440012',
      title: 'First Practice Session',
      duration_seconds: 180,
      audio_url: 'https://demo-bucket.s3.amazonaws.com/session-1.wav',
      status: 'completed',
      metadata: { recording_device: 'web', audio_quality: 'good' },
      created_at: new Date().toISOString(),
    };

    return session;
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Param('sessionId') sessionId: string): Promise<void> {
    // TODO: Replace with actual database delete
    console.log(`Deleting session ${sessionId}`);
  }

  @Post(':sessionId/upload')
  async getUploadUrl(
    @Param('sessionId') sessionId: string,
    @Body() uploadUrlDto: UploadUrlDto,
  ): Promise<UploadUrlResponse> {
    // TODO: Generate actual presigned URL
    const uploadUrl = `https://demo-bucket.s3.amazonaws.com/${sessionId}/${uploadUrlDto.filename}?presigned=true`;
    
    return {
      upload_url: uploadUrl,
      expires_in: 3600, // 1 hour
    };
  }

  @Post(':sessionId/process')
  @HttpCode(HttpStatus.ACCEPTED)
  async processSession(@Param('sessionId') sessionId: string): Promise<{ status: string }> {
    // TODO: Trigger actual processing pipeline
    console.log(`Processing session ${sessionId}`);
    
    return { status: 'processing' };
  }
}
