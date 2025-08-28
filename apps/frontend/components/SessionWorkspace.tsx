'use client';

import { useState, useEffect } from 'react';
import { Box, Grid, GridItem, VStack, HStack, Text, Heading, Badge, Progress, Tabs, TabList, TabPanels, Tab, TabPanel, Icon, useColorModeValue } from '@chakra-ui/react';
import { FileText, BarChart3, Target, MessageSquare, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface SessionWorkspaceProps {
  sessionId: string;
  transcript?: string;
  metrics?: any;
  scores?: any;
  fluency?: any;
}

export default function SessionWorkspace({ sessionId, transcript, metrics, scores, fluency }: SessionWorkspaceProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState(0);
  
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Mock data for demonstration
  const mockMetrics = [
    { time: 0, wpm: 120, pitch: 150, volume: 0.7 },
    { time: 10, wpm: 135, pitch: 145, volume: 0.8 },
    { time: 20, wpm: 110, pitch: 160, volume: 0.6 },
    { time: 30, wpm: 125, pitch: 155, volume: 0.75 },
    { time: 40, wpm: 140, pitch: 140, volume: 0.85 },
    { time: 50, wpm: 115, pitch: 165, volume: 0.65 },
  ];

  const mockSegments = [
    { id: 1, start: 0, end: 10, text: "Hello everyone, thank you for joining us today.", wpm: 120, pitch: 150 },
    { id: 2, start: 10, end: 20, text: "I'm excited to share with you our latest developments.", wpm: 135, pitch: 145 },
    { id: 3, start: 20, end: 30, text: "We've been working hard on improving our processes.", wpm: 110, pitch: 160 },
    { id: 4, start: 30, end: 40, text: "The results have been quite impressive so far.", wpm: 125, pitch: 155 },
    { id: 5, start: 40, end: 50, text: "Let me show you some of the key metrics.", wpm: 140, pitch: 140 },
  ];

  const mockScores = {
    clarity: 85,
    pace: 78,
    volume: 92,
    engagement: 88,
    structure: 82,
    overall: 85,
  };

  const mockFluency = {
    fillerWords: ['um', 'uh', 'like', 'you know'],
    fillerCount: 8,
    grammarErrors: 3,
    vocabularyDiversity: 0.72,
    sentenceComplexity: 'moderate',
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          if (newTime >= 60) {
            setIsPlaying(false);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'green';
    if (score >= 80) return 'blue';
    if (score >= 70) return 'yellow';
    return 'red';
  };

  return (
    <Box p={6}>
      <Grid templateColumns="1fr 400px" gap={6} h="calc(100vh - 200px)">
        {/* Main Content */}
        <GridItem>
          <VStack spacing={6} align="stretch" h="full">
            {/* Audio Player */}
            <Box className="card" p={4}>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="semibold">Audio Player</Text>
                <Text fontFamily="mono">{formatTime(currentTime)} / 01:00</Text>
              </HStack>
              
              <Progress value={(currentTime / 60) * 100} mb={4} />
              
              <HStack justify="center" spacing={4}>
                <Icon as={SkipBack} w={5} h={5} cursor="pointer" />
                <Icon 
                  as={isPlaying ? Pause : Play} 
                  w={8} h={8} 
                  cursor="pointer" 
                  onClick={() => setIsPlaying(!isPlaying)}
                />
                <Icon as={SkipForward} w={5} h={5} cursor="pointer" />
              </HStack>
            </Box>

            {/* Timeline Chart */}
            <Box className="card" p={4} flex={1}>
              <Text fontWeight="semibold" mb={4}>Speech Timeline</Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={mockMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="wpm" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="pitch" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>

            {/* Transcript */}
            <Box className="card" p={4} flex={1}>
              <HStack justify="space-between" mb={4}>
                <Text fontWeight="semibold">Transcript</Text>
                <Badge colorScheme="blue">Live</Badge>
              </HStack>
              
              <Box maxH="300px" overflowY="auto">
                {mockSegments.map((segment, index) => (
                  <Box
                    key={segment.id}
                    p={3}
                    mb={2}
                    border="1px solid"
                    borderColor={selectedSegment === index ? 'primary.500' : borderColor}
                    borderRadius="md"
                    cursor="pointer"
                    onClick={() => setSelectedSegment(index)}
                    _hover={{ bg: 'gray.50' }}
                  >
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="sm" color="gray.600">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </Text>
                      <HStack spacing={2}>
                        <Badge size="sm" colorScheme="blue">{segment.wpm} WPM</Badge>
                        <Badge size="sm" colorScheme="green">{segment.pitch} Hz</Badge>
                      </HStack>
                    </HStack>
                    <Text>{segment.text}</Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </VStack>
        </GridItem>

        {/* Sidebar */}
        <GridItem>
          <VStack spacing={6} align="stretch" h="full">
            {/* Scores Panel */}
            <Box className="card" p={4}>
              <HStack mb={4}>
                <Icon as={Target} w={5} h={5} color="primary.500" />
                <Text fontWeight="semibold">Speech Scores</Text>
              </HStack>
              
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <Text fontSize="sm">Clarity</Text>
                  <Badge colorScheme={getScoreColor(mockScores.clarity)}>{mockScores.clarity}%</Badge>
                </HStack>
                <Progress value={mockScores.clarity} colorScheme={getScoreColor(mockScores.clarity)} />
                
                <HStack justify="space-between">
                  <Text fontSize="sm">Pace</Text>
                  <Badge colorScheme={getScoreColor(mockScores.pace)}>{mockScores.pace}%</Badge>
                </HStack>
                <Progress value={mockScores.pace} colorScheme={getScoreColor(mockScores.pace)} />
                
                <HStack justify="space-between">
                  <Text fontSize="sm">Volume</Text>
                  <Badge colorScheme={getScoreColor(mockScores.volume)}>{mockScores.volume}%</Badge>
                </HStack>
                <Progress value={mockScores.volume} colorScheme={getScoreColor(mockScores.volume)} />
                
                <HStack justify="space-between">
                  <Text fontSize="sm">Engagement</Text>
                  <Badge colorScheme={getScoreColor(mockScores.engagement)}>{mockScores.engagement}%</Badge>
                </HStack>
                <Progress value={mockScores.engagement} colorScheme={getScoreColor(mockScores.engagement)} />
                
                <HStack justify="space-between">
                  <Text fontSize="sm">Structure</Text>
                  <Badge colorScheme={getScoreColor(mockScores.structure)}>{mockScores.structure}%</Badge>
                </HStack>
                <Progress value={mockScores.structure} colorScheme={getScoreColor(mockScores.structure)} />
                
                <Box pt={2} borderTop="1px solid" borderColor={borderColor}>
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Overall</Text>
                    <Badge size="lg" colorScheme={getScoreColor(mockScores.overall)}>{mockScores.overall}%</Badge>
                  </HStack>
                </Box>
              </VStack>
            </Box>

            {/* Fluency Analysis */}
            <Box className="card" p={4} flex={1}>
              <HStack mb={4}>
                <Icon as={BarChart3} w={5} h={5} color="primary.500" />
                <Text fontWeight="semibold">Fluency Analysis</Text>
              </HStack>
              
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>Filler Words ({mockFluency.fillerCount})</Text>
                  <HStack flexWrap="wrap" spacing={1}>
                    {mockFluency.fillerWords.map((word, index) => (
                      <Badge key={index} colorScheme="orange" size="sm">{word}</Badge>
                    ))}
                  </HStack>
                </Box>
                
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={1}>Grammar Errors</Text>
                  <Badge colorScheme="red">{mockFluency.grammarErrors} found</Badge>
                </Box>
                
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={1}>Vocabulary Diversity</Text>
                  <Badge colorScheme="blue">{Math.round(mockFluency.vocabularyDiversity * 100)}%</Badge>
                </Box>
                
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={1}>Sentence Complexity</Text>
                  <Badge colorScheme="purple">{mockFluency.sentenceComplexity}</Badge>
                </Box>
              </VStack>
            </Box>
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
}
