import { Test, TestingModule } from '@nestjs/testing';
import { SpeechAnalysisService } from '../../speech-analysis/speech-analysis.service';

describe('SpeechAnalysisService', () => {
  let service: SpeechAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpeechAnalysisService],
    }).compile();

    service = module.get<SpeechAnalysisService>(SpeechAnalysisService);
  });

  describe('calculateWPM', () => {
    it('should calculate WPM correctly for normal speech', () => {
      const words = 150;
      const durationSeconds = 60;
      const wpm = service.calculateWPM(words, durationSeconds);
      expect(wpm).toBe(150);
    });

    it('should handle zero duration', () => {
      const words = 50;
      const durationSeconds = 0;
      const wpm = service.calculateWPM(words, durationSeconds);
      expect(wpm).toBe(0);
    });

    it('should handle decimal durations', () => {
      const words = 75;
      const durationSeconds = 30.5;
      const wpm = service.calculateWPM(words, durationSeconds);
      expect(wpm).toBeCloseTo(147.54, 2);
    });

    it('should handle very short durations', () => {
      const words = 10;
      const durationSeconds = 5;
      const wpm = service.calculateWPM(words, durationSeconds);
      expect(wpm).toBe(120);
    });
  });

  describe('detectPauses', () => {
    it('should detect pauses in speech segments', () => {
      const segments = [
        { start: 0, end: 2, text: 'Hello world' },
        { start: 3, end: 5, text: 'How are you' },
        { start: 7, end: 9, text: 'I am fine' },
      ];

      const pauses = service.detectPauses(segments, 0.5);
      expect(pauses).toHaveLength(2);
      expect(pauses[0]).toEqual({ start: 2, end: 3, duration: 1 });
      expect(pauses[1]).toEqual({ start: 5, end: 7, duration: 2 });
    });

    it('should not detect pauses shorter than threshold', () => {
      const segments = [
        { start: 0, end: 2, text: 'Hello world' },
        { start: 2.2, end: 4, text: 'How are you' },
      ];

      const pauses = service.detectPauses(segments, 0.5);
      expect(pauses).toHaveLength(0);
    });

    it('should handle empty segments', () => {
      const segments: any[] = [];
      const pauses = service.detectPauses(segments, 0.5);
      expect(pauses).toHaveLength(0);
    });

    it('should handle single segment', () => {
      const segments = [{ start: 0, end: 5, text: 'Hello world' }];
      const pauses = service.detectPauses(segments, 0.5);
      expect(pauses).toHaveLength(0);
    });
  });

  describe('detectFillers', () => {
    it('should detect common filler words', () => {
      const text = 'Um, you know, like, I think that, uh, we should go there.';
      const fillers = service.detectFillers(text);
      
      expect(fillers).toContain('um');
      expect(fillers).toContain('uh');
      expect(fillers).toContain('you know');
      expect(fillers).toContain('like');
      expect(fillers).toContain('I think that');
    });

    it('should handle case insensitive detection', () => {
      const text = 'UM, Uh, YOU KNOW, LIKE';
      const fillers = service.detectFillers(text);
      
      expect(fillers).toContain('um');
      expect(fillers).toContain('uh');
      expect(fillers).toContain('you know');
      expect(fillers).toContain('like');
    });

    it('should handle text without fillers', () => {
      const text = 'This is a clean sentence without any filler words.';
      const fillers = service.detectFillers(text);
      expect(fillers).toHaveLength(0);
    });

    it('should handle empty text', () => {
      const text = '';
      const fillers = service.detectFillers(text);
      expect(fillers).toHaveLength(0);
    });

    it('should handle punctuation in fillers', () => {
      const text = 'Um, uh... you know, like... I mean, right?';
      const fillers = service.detectFillers(text);
      
      expect(fillers).toContain('um');
      expect(fillers).toContain('uh');
      expect(fillers).toContain('you know');
      expect(fillers).toContain('like');
      expect(fillers).toContain('I mean');
    });
  });

  describe('calculateF0', () => {
    it('should calculate F0 from pitch values', () => {
      const pitchValues = [220, 440, 880, 220, 440];
      const f0 = service.calculateF0(pitchValues);
      
      expect(f0).toBeGreaterThan(0);
      expect(f0).toBeLessThan(1000);
    });

    it('should handle empty pitch array', () => {
      const pitchValues: number[] = [];
      const f0 = service.calculateF0(pitchValues);
      expect(f0).toBe(0);
    });

    it('should handle single pitch value', () => {
      const pitchValues = [440];
      const f0 = service.calculateF0(pitchValues);
      expect(f0).toBe(440);
    });

    it('should filter out invalid pitch values', () => {
      const pitchValues = [220, 0, 440, -1, 880, NaN];
      const f0 = service.calculateF0(pitchValues);
      expect(f0).toBeGreaterThan(0);
      expect(f0).toBeLessThan(1000);
    });
  });

  describe('calculateJitter', () => {
    it('should calculate jitter from pitch values', () => {
      const pitchValues = [220, 225, 218, 222, 220, 228, 220, 221];
      const jitter = service.calculateJitter(pitchValues);
      
      expect(jitter).toBeGreaterThan(0);
      expect(jitter).toBeLessThan(1);
    });

    it('should handle insufficient pitch values', () => {
      const pitchValues = [220, 225];
      const jitter = service.calculateJitter(pitchValues);
      expect(jitter).toBe(0);
    });

    it('should handle empty pitch array', () => {
      const pitchValues: number[] = [];
      const jitter = service.calculateJitter(pitchValues);
      expect(jitter).toBe(0);
    });

    it('should handle constant pitch values', () => {
      const pitchValues = [220, 220, 220, 220, 220];
      const jitter = service.calculateJitter(pitchValues);
      expect(jitter).toBe(0);
    });
  });

  describe('calculateShimmer', () => {
    it('should calculate shimmer from amplitude values', () => {
      const amplitudeValues = [0.5, 0.52, 0.48, 0.51, 0.49, 0.53, 0.5, 0.52];
      const shimmer = service.calculateShimmer(amplitudeValues);
      
      expect(shimmer).toBeGreaterThan(0);
      expect(shimmer).toBeLessThan(1);
    });

    it('should handle insufficient amplitude values', () => {
      const amplitudeValues = [0.5, 0.52];
      const shimmer = service.calculateShimmer(amplitudeValues);
      expect(shimmer).toBe(0);
    });

    it('should handle empty amplitude array', () => {
      const amplitudeValues: number[] = [];
      const shimmer = service.calculateShimmer(amplitudeValues);
      expect(shimmer).toBe(0);
    });

    it('should handle constant amplitude values', () => {
      const amplitudeValues = [0.5, 0.5, 0.5, 0.5, 0.5];
      const shimmer = service.calculateShimmer(amplitudeValues);
      expect(shimmer).toBe(0);
    });
  });

  describe('analyzeSpeechQuality', () => {
    it('should provide comprehensive speech analysis', () => {
      const analysisData = {
        words: 150,
        durationSeconds: 60,
        segments: [
          { start: 0, end: 2, text: 'Hello world' },
          { start: 3, end: 5, text: 'How are you' },
        ],
        text: 'Um, hello world, you know, how are you?',
        pitchValues: [220, 225, 218, 222, 220],
        amplitudeValues: [0.5, 0.52, 0.48, 0.51, 0.49],
      };

      const result = service.analyzeSpeechQuality(analysisData);
      
      expect(result).toHaveProperty('wpm');
      expect(result).toHaveProperty('pauses');
      expect(result).toHaveProperty('fillers');
      expect(result).toHaveProperty('f0');
      expect(result).toHaveProperty('jitter');
      expect(result).toHaveProperty('shimmer');
      expect(result).toHaveProperty('qualityScore');
      
      expect(result.wpm).toBe(150);
      expect(result.pauses).toHaveLength(1);
      expect(result.fillers).toContain('um');
      expect(result.fillers).toContain('you know');
      expect(result.qualityScore).toBeGreaterThan(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should handle edge cases gracefully', () => {
      const analysisData = {
        words: 0,
        durationSeconds: 0,
        segments: [],
        text: '',
        pitchValues: [],
        amplitudeValues: [],
      };

      const result = service.analyzeSpeechQuality(analysisData);
      
      expect(result.wpm).toBe(0);
      expect(result.pauses).toHaveLength(0);
      expect(result.fillers).toHaveLength(0);
      expect(result.f0).toBe(0);
      expect(result.jitter).toBe(0);
      expect(result.shimmer).toBe(0);
      expect(result.qualityScore).toBe(0);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate quality score based on multiple factors', () => {
      const factors = {
        wpm: 150,
        pauseCount: 2,
        fillerCount: 3,
        jitter: 0.05,
        shimmer: 0.08,
      };

      const score = service.calculateQualityScore(factors);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should penalize high filler usage', () => {
      const factors1 = { wpm: 150, pauseCount: 2, fillerCount: 1, jitter: 0.05, shimmer: 0.08 };
      const factors2 = { wpm: 150, pauseCount: 2, fillerCount: 10, jitter: 0.05, shimmer: 0.08 };
      
      const score1 = service.calculateQualityScore(factors1);
      const score2 = service.calculateQualityScore(factors2);
      
      expect(score1).toBeGreaterThan(score2);
    });

    it('should penalize high jitter and shimmer', () => {
      const factors1 = { wpm: 150, pauseCount: 2, fillerCount: 3, jitter: 0.05, shimmer: 0.08 };
      const factors2 = { wpm: 150, pauseCount: 2, fillerCount: 3, jitter: 0.2, shimmer: 0.3 };
      
      const score1 = service.calculateQualityScore(factors1);
      const score2 = service.calculateQualityScore(factors2);
      
      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle optimal speech parameters', () => {
      const factors = {
        wpm: 150,
        pauseCount: 1,
        fillerCount: 0,
        jitter: 0.01,
        shimmer: 0.02,
      };

      const score = service.calculateQualityScore(factors);
      expect(score).toBeGreaterThan(80);
    });
  });
});
