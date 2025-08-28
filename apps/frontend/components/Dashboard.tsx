'use client';

import { useState, useEffect } from 'react';
import { Box, Grid, GridItem, VStack, HStack, Text, Heading, Badge, Progress, Card, CardBody, Stat, StatLabel, StatNumber, StatHelpText, StatArrow, useColorModeValue } from '@chakra-ui/react';
import { TrendingUp, TrendingDown, Target, Clock, Award, BarChart3, Users, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export default function Dashboard() {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  // Mock data for demonstration
  const weeklyData = [
    { day: 'Mon', wpm: 120, fillers: 8, clarity: 85, engagement: 88 },
    { day: 'Tue', wpm: 125, fillers: 6, clarity: 87, engagement: 90 },
    { day: 'Wed', wpm: 118, fillers: 9, clarity: 82, engagement: 85 },
    { day: 'Thu', wpm: 132, fillers: 5, clarity: 89, engagement: 92 },
    { day: 'Fri', wpm: 128, fillers: 7, clarity: 86, engagement: 89 },
    { day: 'Sat', wpm: 135, fillers: 4, clarity: 91, engagement: 94 },
    { day: 'Sun', wpm: 130, fillers: 6, clarity: 88, engagement: 91 },
  ];

  const monthlyProgress = [
    { month: 'Jan', sessions: 12, avgScore: 78 },
    { month: 'Feb', sessions: 15, avgScore: 82 },
    { month: 'Mar', sessions: 18, avgScore: 85 },
    { month: 'Apr', sessions: 22, avgScore: 87 },
    { month: 'May', sessions: 25, avgScore: 89 },
    { month: 'Jun', sessions: 28, avgScore: 91 },
  ];

  const skillRadar = [
    { skill: 'Clarity', value: 85 },
    { skill: 'Pace', value: 78 },
    { skill: 'Volume', value: 92 },
    { skill: 'Engagement', value: 88 },
    { skill: 'Structure', value: 82 },
    { skill: 'Fluency', value: 86 },
  ];

  const drillCompletion = [
    { name: 'Minimal Pairs', completed: 15, total: 20 },
    { name: 'Pacing', completed: 12, total: 15 },
    { name: 'Shadowing', completed: 8, total: 12 },
    { name: 'Articulation', completed: 18, total: 25 },
    { name: 'Breathing', completed: 10, total: 10 },
  ];

  const stats = [
    {
      label: 'Total Sessions',
      value: '156',
      change: '+12%',
      trend: 'up',
      icon: Calendar,
      color: 'blue',
    },
    {
      label: 'Average Score',
      value: '87%',
      change: '+5%',
      trend: 'up',
      icon: Award,
      color: 'green',
    },
    {
      label: 'Practice Time',
      value: '42h',
      change: '+8%',
      trend: 'up',
      icon: Clock,
      color: 'purple',
    },
    {
      label: 'Drills Completed',
      value: '63',
      change: '+15%',
      trend: 'up',
      icon: Target,
      color: 'orange',
    },
  ];

  const recentAchievements = [
    { title: 'Perfect Clarity', description: 'Achieved 95% clarity score', date: '2 days ago', type: 'clarity' },
    { title: 'Speed Master', description: 'Maintained 140 WPM for 5 minutes', date: '1 week ago', type: 'pace' },
    { title: 'Filler Free', description: 'Completed session with 0 filler words', date: '2 weeks ago', type: 'fluency' },
    { title: 'Engagement Pro', description: 'Scored 90%+ engagement for 3 sessions', date: '3 weeks ago', type: 'engagement' },
  ];

  const getAchievementColor = (type: string) => {
    switch (type) {
      case 'clarity': return 'blue';
      case 'pace': return 'green';
      case 'fluency': return 'purple';
      case 'engagement': return 'orange';
      default: return 'gray';
    }
  };

  return (
    <Box p={6}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>Dashboard</Heading>
          <Text color="gray.600">
            Track your progress and performance over time
          </Text>
        </Box>

        {/* Stats Cards */}
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} gap={6}>
          {stats.map((stat, index) => (
            <GridItem key={index}>
              <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
                <CardBody>
                  <HStack justify="space-between" mb={4}>
                    <Stat>
                      <StatLabel color="gray.600">{stat.label}</StatLabel>
                      <StatNumber fontSize="2xl" fontWeight="bold">{stat.value}</StatNumber>
                      <StatHelpText>
                        <StatArrow type={stat.trend === 'up' ? 'increase' : 'decrease'} />
                        {stat.change}
                      </StatHelpText>
                    </Stat>
                    <Box
                      p={3}
                      borderRadius="full"
                      bg={`${stat.color}.100`}
                      color={`${stat.color}.600`}
                    >
                      <stat.icon size={24} />
                    </Box>
                  </HStack>
                </CardBody>
              </Card>
            </GridItem>
          ))}
        </Grid>

        {/* Charts Section */}
        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={6}>
          {/* Weekly Trends */}
          <GridItem>
            <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
              <CardBody>
                <Heading size="md" mb={4}>Weekly Performance Trends</Heading>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="wpm" stroke="#8884d8" strokeWidth={2} />
                    <Line type="monotone" dataKey="clarity" stroke="#82ca9d" strokeWidth={2} />
                    <Line type="monotone" dataKey="engagement" stroke="#ffc658" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </GridItem>

          {/* Skill Radar */}
          <GridItem>
            <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
              <CardBody>
                <Heading size="md" mb={4}>Skill Assessment</Heading>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={skillRadar}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Skills"
                      dataKey="value"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* Progress and Achievements */}
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={6}>
          {/* Monthly Progress */}
          <GridItem>
            <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
              <CardBody>
                <Heading size="md" mb={4}>Monthly Progress</Heading>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgScore" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </GridItem>

          {/* Recent Achievements */}
          <GridItem>
            <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
              <CardBody>
                <Heading size="md" mb={4}>Recent Achievements</Heading>
                <VStack spacing={3} align="stretch">
                  {recentAchievements.map((achievement, index) => (
                    <Box
                      key={index}
                      p={3}
                      border="1px solid"
                      borderColor={borderColor}
                      borderRadius="md"
                    >
                      <HStack justify="space-between" mb={1}>
                        <Text fontWeight="semibold">{achievement.title}</Text>
                        <Badge colorScheme={getAchievementColor(achievement.type)}>
                          {achievement.type}
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.600" mb={1}>
                        {achievement.description}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {achievement.date}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>

        {/* Drill Completion */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
          <CardBody>
            <Heading size="md" mb={4}>Drill Completion Progress</Heading>
            <VStack spacing={4} align="stretch">
              {drillCompletion.map((drill, index) => (
                <Box key={index}>
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="medium">{drill.name}</Text>
                    <Text fontSize="sm" color="gray.600">
                      {drill.completed}/{drill.total}
                    </Text>
                  </HStack>
                  <Progress
                    value={(drill.completed / drill.total) * 100}
                    colorScheme={drill.completed === drill.total ? 'green' : 'blue'}
                    height="8px"
                    borderRadius="full"
                  />
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Quick Actions */}
        <Card bg={cardBg} border="1px solid" borderColor={borderColor}>
          <CardBody>
            <Heading size="md" mb={4}>Quick Actions</Heading>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
              <Box
                p={4}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: 'gray.50' }}
                textAlign="center"
              >
                <BarChart3 size={32} className="mx-auto mb-2" />
                <Text fontWeight="medium">Start New Session</Text>
              </Box>
              <Box
                p={4}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: 'gray.50' }}
                textAlign="center"
              >
                <Target size={32} className="mx-auto mb-2" />
                <Text fontWeight="medium">Practice Drills</Text>
              </Box>
              <Box
                p={4}
                border="1px solid"
                borderColor={borderColor}
                borderRadius="md"
                cursor="pointer"
                _hover={{ bg: 'gray.50' }}
                textAlign="center"
              >
                <Users size={32} className="mx-auto mb-2" />
                <Text fontWeight="medium">Share with Coach</Text>
              </Box>
            </Grid>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}
