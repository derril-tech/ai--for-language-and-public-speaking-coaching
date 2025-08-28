import { Injectable } from '@nestjs/common';

@Injectable()
export class DataService {
  async getTranscript(sessionId: string) {
    // TODO: Replace with actual database query
    return {
      id: sessionId,
      text: "Hello, my name is John and I'm here today to talk about public speaking. I think that um, you know, it's really important to um, practice your delivery and um, make sure you're speaking clearly. I've been working on my um, presentation skills and I think I'm getting better at it.",
      words: [
        { word: "Hello", start: 0.0, end: 0.5, confidence: 0.98 },
        { word: "my", start: 0.5, end: 0.7, confidence: 0.95 },
        { word: "name", start: 0.7, end: 1.0, confidence: 0.97 },
        { word: "is", start: 1.0, end: 1.2, confidence: 0.99 },
        { word: "John", start: 1.2, end: 1.8, confidence: 0.96 },
        { word: "and", start: 1.8, end: 2.0, confidence: 0.94 },
        { word: "I'm", start: 2.0, end: 2.3, confidence: 0.93 },
        { word: "here", start: 2.3, end: 2.6, confidence: 0.95 },
        { word: "today", start: 2.6, end: 3.0, confidence: 0.97 },
        { word: "to", start: 3.0, end: 3.2, confidence: 0.98 },
        { word: "talk", start: 3.2, end: 3.6, confidence: 0.96 },
        { word: "about", start: 3.6, end: 3.9, confidence: 0.95 },
        { word: "public", start: 3.9, end: 4.3, confidence: 0.94 },
        { word: "speaking", start: 4.3, end: 4.8, confidence: 0.93 },
      ],
      language: "en",
      duration: 45.2,
      confidence: 0.95,
      filler_words: ["um", "um", "um", "um"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getMetrics(sessionId: string, keys?: string[], start?: string, end?: string) {
    // TODO: Replace with actual TimescaleDB query
    const allMetrics = {
      pitch: {
        mean: 145.2,
        std: 12.8,
        min: 120.1,
        max: 180.5,
        timeline: [
          { timestamp: "2024-01-15T10:00:00Z", value: 142.3 },
          { timestamp: "2024-01-15T10:00:05Z", value: 148.7 },
          { timestamp: "2024-01-15T10:00:10Z", value: 135.9 },
          { timestamp: "2024-01-15T10:00:15Z", value: 156.2 },
        ],
      },
      wpm: {
        current: 120,
        average: 115,
        timeline: [
          { timestamp: "2024-01-15T10:00:00Z", value: 110 },
          { timestamp: "2024-01-15T10:00:05Z", value: 125 },
          { timestamp: "2024-01-15T10:00:10Z", value: 118 },
          { timestamp: "2024-01-15T10:00:15Z", value: 122 },
        ],
      },
      pauses: {
        count: 8,
        total_duration: 3.2,
        average_duration: 0.4,
        timeline: [
          { timestamp: "2024-01-15T10:00:02Z", duration: 0.5 },
          { timestamp: "2024-01-15T10:00:07Z", duration: 0.3 },
          { timestamp: "2024-01-15T10:00:12Z", duration: 0.6 },
        ],
      },
      volume: {
        mean: -18.5,
        std: 2.1,
        min: -22.3,
        max: -15.1,
        timeline: [
          { timestamp: "2024-01-15T10:00:00Z", value: -19.2 },
          { timestamp: "2024-01-15T10:00:05Z", value: -17.8 },
          { timestamp: "2024-01-15T10:00:10Z", value: -20.1 },
          { timestamp: "2024-01-15T10:00:15Z", value: -16.5 },
        ],
      },
    };

    if (keys && keys.length > 0) {
      const filteredMetrics: any = {};
      keys.forEach(key => {
        if (allMetrics[key as keyof typeof allMetrics]) {
          filteredMetrics[key] = allMetrics[key as keyof typeof allMetrics];
        }
      });
      return filteredMetrics;
    }

    return allMetrics;
  }

  async getScores(sessionId: string) {
    // TODO: Replace with actual database query
    return {
      id: sessionId,
      overall_score: 7.2,
      confidence: 0.85,
      rubric_scores: {
        clarity: { score: 7.5, weight: 0.25, feedback: "Good articulation, clear pronunciation" },
        pace: { score: 6.8, weight: 0.20, feedback: "Slightly fast, could use more pauses" },
        volume: { score: 7.0, weight: 0.15, feedback: "Appropriate volume level" },
        engagement: { score: 7.8, weight: 0.20, feedback: "Good eye contact and enthusiasm" },
        structure: { score: 6.5, weight: 0.20, feedback: "Could improve organization" },
      },
      improvement_areas: [
        { category: "pace", suggestion: "Slow down during key points" },
        { category: "structure", suggestion: "Add more transitions between ideas" },
      ],
      strengths: [
        { category: "clarity", detail: "Excellent pronunciation" },
        { category: "engagement", detail: "Good audience connection" },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getFluency(sessionId: string) {
    // TODO: Replace with actual database query
    return {
      id: sessionId,
      filler_word_count: 4,
      filler_word_rate: 0.08, // per word
      filler_words: [
        { word: "um", count: 4, positions: [2.1, 4.5, 8.2, 12.7] },
      ],
      grammar_errors: [
        { type: "subject_verb_agreement", count: 1, examples: ["I think I'm getting better"] },
        { type: "article_usage", count: 2, examples: ["the presentation skills"] },
      ],
      vocabulary_diversity: {
        type_token_ratio: 0.72,
        unique_words: 45,
        total_words: 62,
      },
      sentence_complexity: {
        average_length: 12.4,
        complex_sentences: 3,
        simple_sentences: 2,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getDrills(sessionId: string) {
    // TODO: Replace with actual database query
    return {
      id: sessionId,
      drills: [
        {
          id: "drill_1",
          type: "minimal_pairs",
          title: "P/B Minimal Pairs",
          description: "Practice distinguishing between /p/ and /b/ sounds",
          words: [
            { word: "pat", audio_url: "/audio/pat.mp3" },
            { word: "bat", audio_url: "/audio/bat.mp3" },
            { word: "pin", audio_url: "/audio/pin.mp3" },
            { word: "bin", audio_url: "/audio/bin.mp3" },
          ],
          difficulty: "beginner",
          estimated_duration: 300, // seconds
        },
        {
          id: "drill_2",
          type: "pacing",
          title: "Slow Down Practice",
          description: "Practice speaking at a slower, more measured pace",
          text: "The quick brown fox jumps over the lazy dog. Practice speaking each word clearly and deliberately.",
          target_wpm: 100,
          metronome_bpm: 60,
          difficulty: "intermediate",
          estimated_duration: 180,
        },
        {
          id: "drill_3",
          type: "shadowing",
          title: "Shadowing Exercise",
          description: "Repeat after the audio with minimal delay",
          audio_url: "/audio/shadowing_sample.mp3",
          transcript: "Public speaking is a skill that improves with practice.",
          difficulty: "advanced",
          estimated_duration: 240,
        },
      ],
      recommendations: [
        {
          drill_id: "drill_1",
          reason: "You had difficulty with /p/ and /b/ sounds in your speech",
          priority: "high",
        },
        {
          drill_id: "drill_2",
          reason: "Your speaking pace was slightly fast",
          priority: "medium",
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}
