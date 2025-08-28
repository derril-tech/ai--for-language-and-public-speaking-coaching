'use client';

import { useState, useRef, useEffect } from 'react';
import { Box, Button, VStack, HStack, Text, Progress, Icon, useToast } from '@chakra-ui/react';
import { Mic, MicOff, Video, VideoOff, Settings, Play, Square } from 'lucide-react';

interface RecorderProps {
  onRecordingStart?: () => void;
  onRecordingStop?: (blob: Blob) => void;
  onLevelChange?: (level: number) => void;
}

export default function Recorder({ onRecordingStart, onRecordingStop, onLevelChange }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMicTested, setIsMicTested] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const toast = useToast();

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      streamRef.current = stream;
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        const average = dataArrayRef.current.reduce((a, b) => a + b) / dataArrayRef.current.length;
        const level = (average / 255) * 100;
        
        setAudioLevel(level);
        onLevelChange?.(level);
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
      setIsMicTested(true);
      
      toast({
        title: 'Microphone Tested',
        description: 'Your microphone is working properly',
        status: 'success',
        duration: 3000,
      });
      
    } catch (error) {
      toast({
        title: 'Microphone Error',
        description: 'Unable to access microphone. Please check permissions.',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const startRecording = async () => {
    try {
      const mediaType = isVideoMode ? { audio: true, video: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(mediaType);
      
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: isVideoMode ? 'video/webm;codecs=vp9' : 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { 
          type: isVideoMode ? 'video/webm' : 'audio/webm' 
        });
        onRecordingStop?.(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStart?.();
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast({
        title: 'Recording Started',
        description: isVideoMode ? 'Video recording in progress' : 'Audio recording in progress',
        status: 'success',
        duration: 2000,
      });
      
    } catch (error) {
      toast({
        title: 'Recording Error',
        description: 'Unable to start recording. Please check permissions.',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast({
        title: 'Recording Stopped',
        description: 'Your recording has been saved',
        status: 'success',
        duration: 3000,
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box className="card" p={6}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="semibold">
            {isVideoMode ? 'Video Recorder' : 'Audio Recorder'}
          </Text>
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Settings />}
              onClick={testMicrophone}
              isDisabled={isRecording}
            >
              Test Mic
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={isVideoMode ? <Video /> : <VideoOff />}
              onClick={() => setIsVideoMode(!isVideoMode)}
              isDisabled={isRecording}
            >
              {isVideoMode ? 'Video' : 'Audio'}
            </Button>
          </HStack>
        </HStack>

        {/* Audio Level Meter */}
        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>
            Audio Level
          </Text>
          <Progress
            value={audioLevel}
            colorScheme={audioLevel > 80 ? 'red' : audioLevel > 60 ? 'orange' : 'green'}
            height="8px"
            borderRadius="full"
          />
          <Text fontSize="xs" color="gray.500" mt={1}>
            {Math.round(audioLevel)}%
          </Text>
        </Box>

        {/* Recording Timer */}
        {isRecording && (
          <Box textAlign="center">
            <Text fontSize="2xl" fontFamily="mono" fontWeight="bold" color="red.500">
              {formatTime(recordingTime)}
            </Text>
            <Text fontSize="sm" color="gray.600">
              Recording in progress...
            </Text>
          </Box>
        )}

        {/* Recording Controls */}
        <HStack justify="center" spacing={4}>
          {!isRecording ? (
            <Button
              size="lg"
              colorScheme="red"
              leftIcon={<Mic />}
              onClick={startRecording}
              isDisabled={!isMicTested}
              _hover={{ transform: 'scale(1.05)' }}
              transition="all 0.2s"
            >
              Start Recording
            </Button>
          ) : (
            <Button
              size="lg"
              colorScheme="gray"
              leftIcon={<Square />}
              onClick={stopRecording}
              _hover={{ transform: 'scale(1.05)' }}
              transition="all 0.2s"
            >
              Stop Recording
            </Button>
          )}
        </HStack>

        {/* Status */}
        <Box textAlign="center">
          <Text fontSize="sm" color="gray.600">
            {!isMicTested && 'Please test your microphone first'}
            {isMicTested && !isRecording && 'Ready to record'}
            {isRecording && `${isVideoMode ? 'Video' : 'Audio'} recording in progress`}
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}
