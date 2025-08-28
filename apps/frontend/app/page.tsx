'use client';

import { useState } from 'react';
import { Box, Container, Heading, Text, Button, VStack, HStack, Grid, GridItem, Icon, useColorModeValue } from '@chakra-ui/react';
import { Mic, Play, BarChart3, Users, Target, Zap, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false);
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');

  const features = [
    {
      icon: Mic,
      title: 'Real-time Speech Analysis',
      description: 'Get instant feedback on pronunciation, pace, and clarity as you speak.',
    },
    {
      icon: BarChart3,
      title: 'Detailed Analytics',
      description: 'Track your progress with comprehensive metrics and performance insights.',
    },
    {
      icon: Target,
      title: 'Personalized Drills',
      description: 'Practice with AI-generated exercises tailored to your specific needs.',
    },
    {
      icon: Users,
      title: 'Coach Collaboration',
      description: 'Share sessions with coaches for expert guidance and feedback.',
    },
  ];

  return (
    <Box bg={bgColor} minH="100vh">
      {/* Hero Section */}
      <Container maxW="container.xl" py={20}>
        <VStack spacing={8} textAlign="center">
          <Heading
            as="h1"
            size="2xl"
            bgGradient="linear(to-r, primary.600, secondary.600)"
            bgClip="text"
            fontWeight="bold"
          >
            Master Your Speaking Skills
          </Heading>
          <Text fontSize="xl" color="gray.600" maxW="2xl">
            AI-powered language and public speaking coaching that adapts to your unique voice and goals.
            Get real-time feedback, personalized exercises, and track your progress.
          </Text>
          
          <HStack spacing={4}>
            <Button
              size="lg"
              colorScheme="primary"
              leftIcon={<Mic />}
              onClick={() => setIsRecording(!isRecording)}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
              transition="all 0.2s"
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              rightIcon={<ArrowRight />}
              _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg' }}
              transition="all 0.2s"
            >
              View Demo
            </Button>
          </HStack>
        </VStack>
      </Container>

      {/* Features Section */}
      <Container maxW="container.xl" py={16}>
        <VStack spacing={12}>
          <VStack spacing={4} textAlign="center">
            <Heading size="xl">Why Choose AI Coaching?</Heading>
            <Text fontSize="lg" color="gray.600" maxW="2xl">
              Our advanced AI analyzes every aspect of your speech to provide comprehensive feedback and personalized improvement plans.
            </Text>
          </VStack>

          <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} gap={8}>
            {features.map((feature, index) => (
              <GridItem key={index}>
                <Box
                  bg={cardBg}
                  p={6}
                  rounded="xl"
                  shadow="soft"
                  textAlign="center"
                  _hover={{ transform: 'translateY(-4px)', shadow: 'medium' }}
                  transition="all 0.3s"
                >
                  <Icon
                    as={feature.icon}
                    w={8}
                    h={8}
                    color="primary.500"
                    mb={4}
                  />
                  <Heading size="md" mb={3}>
                    {feature.title}
                  </Heading>
                  <Text color="gray.600">
                    {feature.description}
                  </Text>
                </Box>
              </GridItem>
            ))}
          </Grid>
        </VStack>
      </Container>

      {/* CTA Section */}
      <Box bg="primary.600" py={16}>
        <Container maxW="container.xl">
          <VStack spacing={6} textAlign="center" color="white">
            <Heading size="xl">Ready to Transform Your Speaking?</Heading>
            <Text fontSize="lg" maxW="2xl">
              Join thousands of professionals who have improved their communication skills with AI-powered coaching.
            </Text>
            <Button
              size="lg"
              bg="white"
              color="primary.600"
              _hover={{ bg: 'gray.100' }}
              leftIcon={<Zap />}
            >
              Get Started Free
            </Button>
          </VStack>
        </Container>
      </Box>
    </Box>
  );
}
