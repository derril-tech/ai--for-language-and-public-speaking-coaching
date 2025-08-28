'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, VStack, HStack, Text, Button, Heading, Badge, Progress, Grid, GridItem, Icon, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@chakra-ui/react';
import { Play, Pause, Volume2, Target, Clock, CheckCircle, XCircle, RotateCcw, Settings } from 'lucide-react';

interface Drill {
  id: string;
  type: 'minimal_pairs' | 'pacing' | 'shadowing' | 'articulation' | 'breathing';
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  content: any;
  completed: boolean;
  score?: number;
}

export default function DrillsUI() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [currentDrill, setCurrentDrill] = useState<Drill | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Mock drills data
  const mockDrills: Drill[] = [
    {
      id: '1',
      type: 'minimal_pairs',
      title: 'Minimal Pairs: B vs P',
      description: 'Practice distinguishing between voiced and voiceless bilabial stops',
      difficulty: 'beginner',
      duration: 120,
      content: {
        pairs: [
          { word1: 'bat', word2: 'pat', correct: 'bat' },
          { word1: 'bin', word2: 'pin', correct: 'bin' },
          { word1: 'bet', word2: 'pet', correct: 'bet' },
          { word1: 'boat', word2: 'poat', correct: 'boat' },
        ]
      },
      completed: false,
    },
    {
      id: '2',
      type: 'pacing',
      title: 'Pacing Exercise: Slow to Fast',
      description: 'Practice controlling your speaking pace with metronome guidance',
      difficulty: 'intermediate',
      duration: 180,
      content: {
        phrases: [
          'The quick brown fox jumps over the lazy dog.',
          'She sells seashells by the seashore.',
          'How much wood would a woodchuck chuck?',
        ],
        tempos: [60, 80, 100, 120]
      },
      completed: false,
    },
    {
      id: '3',
      type: 'shadowing',
      title: 'Shadowing: Business Presentation',
      description: 'Follow along with a professional speaker to improve pronunciation',
      difficulty: 'advanced',
      duration: 240,
      content: {
        audioUrl: '/audio/business-presentation.mp3',
        transcript: 'Welcome to our quarterly review. Today we will discuss...',
        targetPhrases: ['quarterly review', 'market analysis', 'strategic planning']
      },
      completed: false,
    },
    {
      id: '4',
      type: 'articulation',
      title: 'Articulation: Tongue Twisters',
      description: 'Improve clarity with challenging tongue twisters',
      difficulty: 'intermediate',
      duration: 150,
      content: {
        twisters: [
          'Peter Piper picked a peck of pickled peppers.',
          'She sells seashells by the seashore.',
          'How can a clam cram in a clean cream can?',
        ]
      },
      completed: false,
    },
    {
      id: '5',
      type: 'breathing',
      title: 'Breathing Control',
      description: 'Master breath control for better speech delivery',
      difficulty: 'beginner',
      duration: 90,
      content: {
        exercises: [
          { name: 'Deep Breathing', duration: 30, instruction: 'Inhale for 4, hold for 4, exhale for 6' },
          { name: 'Diaphragmatic Breathing', duration: 30, instruction: 'Breathe from your diaphragm' },
          { name: 'Paced Breathing', duration: 30, instruction: 'Match breathing to speech rhythm' },
        ]
      },
      completed: false,
    },
  ];

  useEffect(() => {
    setDrills(mockDrills);
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timeLeft > 0 && isPlaying) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleDrillComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeLeft, isPlaying]);

  const startDrill = (drill: Drill) => {
    setCurrentDrill(drill);
    setCurrentStep(0);
    setUserAnswers([]);
    setScore(0);
    setTimeLeft(drill.duration);
    setIsPlaying(true);
    onOpen();
  };

  const handleDrillComplete = () => {
    setIsPlaying(false);
    if (currentDrill) {
      const finalScore = Math.round((score / getMaxScore()) * 100);
      setDrills(prev => prev.map(d => 
        d.id === currentDrill.id 
          ? { ...d, completed: true, score: finalScore }
          : d
      ));
      
      toast({
        title: 'Drill Completed!',
        description: `Your score: ${finalScore}%`,
        status: 'success',
        duration: 3000,
      });
    }
    onClose();
  };

  const getMaxScore = () => {
    if (!currentDrill) return 1;
    switch (currentDrill.type) {
      case 'minimal_pairs':
        return currentDrill.content.pairs.length;
      case 'pacing':
        return currentDrill.content.phrases.length * currentDrill.content.tempos.length;
      case 'shadowing':
        return currentDrill.content.targetPhrases.length;
      case 'articulation':
        return currentDrill.content.twisters.length;
      case 'breathing':
        return currentDrill.content.exercises.length;
      default:
        return 1;
    }
  };

  const handleAnswer = (answer: string) => {
    if (!currentDrill) return;
    
    const newAnswers = [...userAnswers, answer];
    setUserAnswers(newAnswers);
    
    // Check if answer is correct
    let isCorrect = false;
    switch (currentDrill.type) {
      case 'minimal_pairs':
        isCorrect = answer === currentDrill.content.pairs[currentStep].correct;
        break;
      // Add other drill type logic here
    }
    
    if (isCorrect) {
      setScore(prev => prev + 1);
      toast({
        title: 'Correct!',
        status: 'success',
        duration: 1000,
      });
    } else {
      toast({
        title: 'Try again',
        status: 'warning',
        duration: 1000,
      });
    }
    
    setCurrentStep(prev => prev + 1);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'green';
      case 'intermediate': return 'yellow';
      case 'advanced': return 'red';
      default: return 'gray';
    }
  };

  const renderDrillContent = () => {
    if (!currentDrill) return null;

    switch (currentDrill.type) {
      case 'minimal_pairs':
        if (currentStep >= currentDrill.content.pairs.length) return null;
        const pair = currentDrill.content.pairs[currentStep];
        return (
          <VStack spacing={6}>
            <Text fontSize="lg" fontWeight="semibold">
              Which word did you hear?
            </Text>
            <HStack spacing={4}>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleAnswer(pair.word1)}
                _hover={{ bg: 'primary.50' }}
              >
                {pair.word1}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleAnswer(pair.word2)}
                _hover={{ bg: 'primary.50' }}
              >
                {pair.word2}
              </Button>
            </HStack>
            <Text fontSize="sm" color="gray.600">
              Step {currentStep + 1} of {currentDrill.content.pairs.length}
            </Text>
          </VStack>
        );

      case 'pacing':
        return (
          <VStack spacing={6}>
            <Text fontSize="lg" fontWeight="semibold">
              Repeat at the target pace:
            </Text>
            <Box p={4} bg="gray.50" borderRadius="md" textAlign="center">
              <Text fontSize="xl" fontFamily="mono" color="primary.600">
                {currentDrill.content.tempos[currentStep % currentDrill.content.tempos.length]} BPM
              </Text>
            </Box>
            <Text fontSize="lg">
              "{currentDrill.content.phrases[Math.floor(currentStep / currentDrill.content.tempos.length)]}"
            </Text>
          </VStack>
        );

      case 'breathing':
        const exercise = currentDrill.content.exercises[currentStep];
        return (
          <VStack spacing={6}>
            <Text fontSize="lg" fontWeight="semibold">
              {exercise.name}
            </Text>
            <Text fontSize="md" textAlign="center">
              {exercise.instruction}
            </Text>
            <Box p={4} bg="blue.50" borderRadius="md" textAlign="center">
              <Text fontSize="2xl" fontFamily="mono" color="blue.600">
                {timeLeft}s remaining
              </Text>
            </Box>
          </VStack>
        );

      default:
        return <Text>Drill content not implemented</Text>;
    }
  };

  return (
    <Box p={6}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Practice Drills</Heading>
          <Text color="gray.600">
            Personalized exercises to improve your speaking skills
          </Text>
        </Box>

        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap={6}>
          {drills.map((drill) => (
            <GridItem key={drill.id}>
              <Box className="card" p={6} h="full">
                <VStack spacing={4} align="stretch" h="full">
                  <HStack justify="space-between">
                    <Badge colorScheme={getDifficultyColor(drill.difficulty)}>
                      {drill.difficulty}
                    </Badge>
                    {drill.completed && (
                      <Icon as={CheckCircle} w={5} h={5} color="green.500" />
                    )}
                  </HStack>

                  <Box flex={1}>
                    <Heading size="md" mb={2}>{drill.title}</Heading>
                    <Text fontSize="sm" color="gray.600" mb={3}>
                      {drill.description}
                    </Text>
                    
                    <HStack spacing={4} fontSize="sm" color="gray.500">
                      <HStack>
                        <Icon as={Clock} w={4} h={4} />
                        <Text>{formatTime(drill.duration)}</Text>
                      </HStack>
                      <HStack>
                        <Icon as={Target} w={4} h={4} />
                        <Text>{drill.type.replace('_', ' ')}</Text>
                      </HStack>
                    </HStack>
                  </Box>

                  {drill.completed && drill.score !== undefined && (
                    <Box>
                      <Text fontSize="sm" color="gray.600" mb={1}>Score</Text>
                      <Progress value={drill.score} colorScheme="green" mb={2} />
                      <Text fontSize="sm" fontWeight="semibold">{drill.score}%</Text>
                    </Box>
                  )}

                  <Button
                    colorScheme="primary"
                    onClick={() => startDrill(drill)}
                    isDisabled={isPlaying}
                    leftIcon={<Play />}
                  >
                    {drill.completed ? 'Practice Again' : 'Start Drill'}
                  </Button>
                </VStack>
              </Box>
            </GridItem>
          ))}
        </Grid>

        {/* Drill Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              <HStack justify="space-between">
                <Text>{currentDrill?.title}</Text>
                <HStack spacing={2}>
                  <Icon as={Clock} w={4} h={4} />
                  <Text fontFamily="mono">{formatTime(timeLeft)}</Text>
                </HStack>
              </HStack>
            </ModalHeader>
            
            <ModalBody>
              <VStack spacing={6}>
                {renderDrillContent()}
                
                {score > 0 && (
                  <Box textAlign="center">
                    <Text fontSize="sm" color="gray.600">Current Score</Text>
                    <Text fontSize="2xl" fontWeight="bold" color="primary.600">
                      {Math.round((score / getMaxScore()) * 100)}%
                    </Text>
                  </Box>
                )}
              </VStack>
            </ModalBody>
            
            <ModalFooter>
              <HStack spacing={3}>
                <Button
                  variant="outline"
                  leftIcon={<RotateCcw />}
                  onClick={() => {
                    setCurrentStep(0);
                    setUserAnswers([]);
                    setScore(0);
                    setTimeLeft(currentDrill?.duration || 0);
                  }}
                >
                  Restart
                </Button>
                <Button
                  colorScheme="red"
                  onClick={onClose}
                >
                  Exit Drill
                </Button>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Box>
  );
}
