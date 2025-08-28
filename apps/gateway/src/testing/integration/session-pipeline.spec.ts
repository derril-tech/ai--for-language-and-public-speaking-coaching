import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { SessionsController } from '../../sessions/sessions.controller';
import { AuthService } from '../../auth/auth.service';

describe('Session Processing Pipeline (Integration)', () => {
  let app: INestApplication;
  let sessionsController: SessionsController;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    sessionsController = moduleFixture.get<SessionsController>(SessionsController);
    authService = moduleFixture.get<AuthService>(AuthService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Session Pipeline', () => {
    let sessionId: string;
    let authToken: string;
    let userId: string;
    let organizationId: string;

    beforeAll(async () => {
      // Setup test user and authentication
      const testUser = {
        email: 'test@example.com',
        password: 'testpassword123',
        firstName: 'Test',
        lastName: 'User',
      };

      // Create test user and get auth token
      const authResult = await authService.register(testUser);
      authToken = authResult.accessToken;
      userId = authResult.user.id;
      organizationId = authResult.user.organizationId;
    });

    it('should create a new session', async () => {
      const sessionData = {
        title: 'Test Session',
        description: 'Integration test session',
        language: 'en',
        duration: 120,
      };

      const response = await request(app.getHttpServer())
        .post('/v1/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(sessionData.title);
      expect(response.body.status).toBe('created');
      
      sessionId = response.body.id;
    });

    it('should upload audio file to session', async () => {
      // Create a mock audio file buffer
      const mockAudioBuffer = Buffer.from('mock audio data');
      
      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', mockAudioBuffer, 'test-audio.wav')
        .expect(200);

      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body.status).toBe('uploading');
    });

    it('should trigger session processing', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('processingId');
      expect(response.body.status).toBe('processing');
    });

    it('should get session processing status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/sessions/${sessionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['processing', 'completed', 'failed']).toContain(response.body.status);
    });

    it('should get session transcript when processing completes', async () => {
      // Wait for processing to complete (with timeout)
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout
      
      while (attempts < maxAttempts) {
        const statusResponse = await request(app.getHttpServer())
          .get(`/v1/sessions/${sessionId}/status`)
          .set('Authorization', `Bearer ${authToken}`);

        if (statusResponse.body.status === 'completed') {
          break;
        } else if (statusResponse.body.status === 'failed') {
          throw new Error('Session processing failed');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Session processing timeout');
      }

      const response = await request(app.getHttpServer())
        .get(`/v1/sessions/${sessionId}/transcript`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('text');
      expect(response.body).toHaveProperty('segments');
      expect(response.body).toHaveProperty('confidence');
    });

    it('should get session metrics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/sessions/${sessionId}/metrics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('wpm');
      expect(response.body).toHaveProperty('pitch');
      expect(response.body).toHaveProperty('volume');
      expect(response.body).toHaveProperty('fillers');
      expect(response.body).toHaveProperty('pauses');
    });

    it('should get session scores', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/sessions/${sessionId}/scores`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('clarity');
      expect(response.body).toHaveProperty('fluency');
      expect(response.body).toHaveProperty('pace');
      expect(response.body).toHaveProperty('volume');
    });

    it('should get session fluency analysis', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/sessions/${sessionId}/fluency`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('fillerWords');
      expect(response.body).toHaveProperty('grammarErrors');
      expect(response.body).toHaveProperty('repetitions');
      expect(response.body).toHaveProperty('suggestions');
    });

    it('should generate drills for the session', async () => {
      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/drills`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ type: 'minimal_pairs' })
        .expect(200);

      expect(response.body).toHaveProperty('drills');
      expect(Array.isArray(response.body.drills)).toBe(true);
    });

    it('should create a clip from the session', async () => {
      const clipData = {
        startTime: 10,
        endTime: 30,
        title: 'Test Clip',
        description: 'Integration test clip',
      };

      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/clips`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(clipData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      expect(response.body.title).toBe(clipData.title);
    });

    it('should generate a report for the session', async () => {
      const reportData = {
        format: 'pdf',
        includeCharts: true,
        includeTimeline: true,
      };

      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/reports`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reportData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      expect(response.body.format).toBe(reportData.format);
    });

    it('should get the complete session with all data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', sessionId);
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('status', 'completed');
      expect(response.body).toHaveProperty('transcript');
      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('scores');
      expect(response.body).toHaveProperty('fluency');
    });

    it('should allow adding comments to the session', async () => {
      const commentData = {
        text: 'Great improvement on pacing!',
        timestamp: 15.5,
        type: 'praise',
      };

      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(commentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.text).toBe(commentData.text);
      expect(response.body.timestamp).toBe(commentData.timestamp);
    });

    it('should allow sharing the session', async () => {
      const shareData = {
        permissions: ['view'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData)
        .expect(200);

      expect(response.body).toHaveProperty('shareUrl');
      expect(response.body).toHaveProperty('shareId');
      expect(response.body).toHaveProperty('expiresAt');
    });

    it('should allow searching within the session', async () => {
      const searchData = {
        query: 'test',
        type: 'text',
      };

      const response = await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/search`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(searchData)
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should delete the session and all associated data', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');

      // Verify session is deleted
      await request(app.getHttpServer())
        .get(`/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid session ID', async () => {
      const invalidSessionId = 'invalid-session-id';
      
      await request(app.getHttpServer())
        .get(`/v1/sessions/${invalidSessionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle unauthorized access', async () => {
      await request(app.getHttpServer())
        .get('/v1/sessions/some-session-id')
        .expect(401);
    });

    it('should handle invalid file upload', async () => {
      const sessionData = {
        title: 'Error Test Session',
        description: 'Testing error handling',
        language: 'en',
        duration: 60,
      };

      const sessionResponse = await request(app.getHttpServer())
        .post('/v1/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      const sessionId = sessionResponse.body.id;

      // Try to upload invalid file
      const invalidFileBuffer = Buffer.from('invalid file data');
      
      await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', invalidFileBuffer, 'invalid-file.txt')
        .expect(400);
    });

    it('should handle processing failures gracefully', async () => {
      const sessionData = {
        title: 'Failure Test Session',
        description: 'Testing processing failure handling',
        language: 'en',
        duration: 60,
      };

      const sessionResponse = await request(app.getHttpServer())
        .post('/v1/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      const sessionId = sessionResponse.body.id;

      // Try to process without uploaded file
      await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/process`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple concurrent session creations', async () => {
      const sessionPromises = Array.from({ length: 5 }, (_, i) => {
        const sessionData = {
          title: `Concurrent Session ${i + 1}`,
          description: `Concurrent test session ${i + 1}`,
          language: 'en',
          duration: 60,
        };

        return request(app.getHttpServer())
          .post('/v1/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .send(sessionData);
      });

      const responses = await Promise.all(sessionPromises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title');
      });
    });

    it('should handle concurrent processing requests', async () => {
      const sessionData = {
        title: 'Concurrent Processing Test',
        description: 'Testing concurrent processing',
        language: 'en',
        duration: 60,
      };

      const sessionResponse = await request(app.getHttpServer())
        .post('/v1/sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(sessionData)
        .expect(201);

      const sessionId = sessionResponse.body.id;

      // Upload file first
      const mockAudioBuffer = Buffer.from('mock audio data');
      await request(app.getHttpServer())
        .post(`/v1/sessions/${sessionId}/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', mockAudioBuffer, 'test-audio.wav')
        .expect(200);

      // Try concurrent processing requests
      const processingPromises = Array.from({ length: 3 }, () => {
        return request(app.getHttpServer())
          .post(`/v1/sessions/${sessionId}/process`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({});
      });

      const responses = await Promise.all(processingPromises);
      
      // Should handle concurrent requests gracefully
      responses.forEach(response => {
        expect([200, 409]).toContain(response.status);
      });
    });
  });
});
