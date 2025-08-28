'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@chakra-ui/react';
import { io, Socket } from 'socket.io-client';

interface WebSocketClientProps {
  sessionId?: string;
  onAsrTokens?: (tokens: any[]) => void;
  onMetrics?: (metrics: any) => void;
  onScores?: (scores: any) => void;
  onProcessingStatus?: (status: string) => void;
  onContentReady?: (content: any) => void;
}

export default function WebSocketClient({
  sessionId,
  onAsrTokens,
  onMetrics,
  onScores,
  onProcessingStatus,
  onContentReady,
}: WebSocketClientProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toast = useToast();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setConnectionStatus('connecting');
    
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('WebSocket connected');
      
      toast({
        title: 'Connected',
        description: 'Real-time updates enabled',
        status: 'success',
        duration: 2000,
      });

      // Join session room if sessionId is provided
      if (sessionId) {
        socket.emit('join-session', { sessionId });
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.log('WebSocket disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      setConnectionStatus('error');
      console.error('WebSocket connection error:', error);
      
      toast({
        title: 'Connection Error',
        description: 'Unable to connect to real-time updates',
        status: 'error',
        duration: 5000,
      });
    });

    socket.on('reconnect', (attemptNumber) => {
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      
      toast({
        title: 'Reconnected',
        description: 'Real-time updates restored',
        status: 'success',
        duration: 2000,
      });

      // Rejoin session room
      if (sessionId) {
        socket.emit('join-session', { sessionId });
      }
    });

    socket.on('reconnect_error', (error) => {
      setConnectionStatus('error');
      console.error('WebSocket reconnection error:', error);
    });

    socket.on('reconnect_failed', () => {
      setConnectionStatus('error');
      console.error('WebSocket reconnection failed');
      
      toast({
        title: 'Connection Failed',
        description: 'Unable to restore real-time updates',
        status: 'error',
        duration: 5000,
      });
    });

    // Session-specific events
    socket.on('asr-tokens', (data) => {
      console.log('Received ASR tokens:', data);
      onAsrTokens?.(data.tokens);
    });

    socket.on('metrics', (data) => {
      console.log('Received metrics:', data);
      onMetrics?.(data.metrics);
    });

    socket.on('scores', (data) => {
      console.log('Received scores:', data);
      onScores?.(data.scores);
    });

    socket.on('processing-status', (data) => {
      console.log('Received processing status:', data);
      onProcessingStatus?.(data.status);
      
      // Show toast for important status updates
      if (data.status === 'completed') {
        toast({
          title: 'Processing Complete',
          description: 'Your session analysis is ready',
          status: 'success',
          duration: 3000,
        });
      } else if (data.status === 'failed') {
        toast({
          title: 'Processing Failed',
          description: data.message || 'An error occurred during processing',
          status: 'error',
          duration: 5000,
        });
      }
    });

    socket.on('content-ready', (data) => {
      console.log('Received content ready:', data);
      onContentReady?.(data.content);
      
      toast({
        title: 'Content Ready',
        description: data.type === 'clip' ? 'Video clip is ready' : 'Report is ready',
        status: 'success',
        duration: 3000,
      });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: 'WebSocket Error',
        description: error.message || 'An error occurred',
        status: 'error',
        duration: 5000,
      });
    });

  }, [sessionId, onAsrTokens, onMetrics, onScores, onProcessingStatus, onContentReady, toast]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const joinSession = useCallback((sessionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-session', { sessionId });
    }
  }, []);

  const leaveSession = useCallback((sessionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-session', { sessionId });
    }
  }, []);

  const sendMessage = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot send message:', event);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, disconnect]);

  // Reconnect when sessionId changes
  useEffect(() => {
    if (sessionId && socketRef.current?.connected) {
      socketRef.current.emit('join-session', { sessionId });
    }
  }, [sessionId]);

  // Manual reconnection
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 1000);
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    reconnect,
    joinSession,
    leaveSession,
    sendMessage,
  };
}

// Hook for using WebSocket in components
export function useWebSocket(props: WebSocketClientProps) {
  return WebSocketClient(props);
}
