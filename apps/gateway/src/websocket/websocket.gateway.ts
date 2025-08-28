import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/sessions',
})
export class WebSocketGateway {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, Socket>();

  @UseGuards(JwtAuthGuard)
  handleConnection(client: Socket) {
    const sessionId = client.handshake.query.sessionId as string;
    if (sessionId) {
      this.connectedClients.set(sessionId, client);
      client.join(`session:${sessionId}`);
      console.log(`Client connected to session: ${sessionId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const sessionId = client.handshake.query.sessionId as string;
    if (sessionId) {
      this.connectedClients.delete(sessionId);
      client.leave(`session:${sessionId}`);
      console.log(`Client disconnected from session: ${sessionId}`);
    }
  }

  @SubscribeMessage('join_session')
  handleJoinSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    client.join(`session:${sessionId}`);
    this.connectedClients.set(sessionId, client);
    console.log(`Client joined session: ${sessionId}`);
    return { success: true, sessionId };
  }

  @SubscribeMessage('leave_session')
  handleLeaveSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    client.leave(`session:${sessionId}`);
    this.connectedClients.delete(sessionId);
    console.log(`Client left session: ${sessionId}`);
    return { success: true, sessionId };
  }

  // Method to emit ASR tokens to connected clients
  emitAsrTokens(sessionId: string, tokens: any) {
    this.server.to(`session:${sessionId}`).emit('asr_tokens', {
      sessionId,
      tokens,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit metrics to connected clients
  emitMetrics(sessionId: string, metrics: any) {
    this.server.to(`session:${sessionId}`).emit('metrics', {
      sessionId,
      metrics,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit scores to connected clients
  emitScores(sessionId: string, scores: any) {
    this.server.to(`session:${sessionId}`).emit('scores', {
      sessionId,
      scores,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit processing status updates
  emitProcessingStatus(sessionId: string, status: any) {
    this.server.to(`session:${sessionId}`).emit('processing_status', {
      sessionId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  // Method to emit clip/report completion notifications
  emitContentReady(sessionId: string, content: any) {
    this.server.to(`session:${sessionId}`).emit('content_ready', {
      sessionId,
      content,
      timestamp: new Date().toISOString(),
    });
  }
}
