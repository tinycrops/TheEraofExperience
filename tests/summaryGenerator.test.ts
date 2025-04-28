import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock GoogleGenerativeAI
vi.mock('@google/genai', async () => {
  return {
    generateContentStream: vi.fn(),
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContentStream: vi.fn(),
      }),
    })),
  };
});

import { generateSummary } from '../src/summaryGenerator';
import * as genai from '@google/genai';

// Helper to create a fake async stream
function makeFakeStream(content: string) {
  return {
    stream: (async function* () {
      yield { text: content };
    })(),
  };
}

describe('summaryGenerator', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockGenerateContentStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GEMINI_API_KEY = 'fake-api-key';
    
    // Reset and set up the mock implementation
    mockGenerateContentStream = vi.fn();
    (genai.generateContentStream as any) = mockGenerateContentStream;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  it('generates summaries from log chunks', async () => {
    const logChunks = [
      [{ timestamp: '2023-01-01', level: 'info', message: 'Test log 1' }],
      [{ timestamp: '2023-01-01', level: 'info', message: 'Test log 2' }]
    ];

    // Mock the first and second calls with different responses
    mockGenerateContentStream
      .mockResolvedValueOnce(makeFakeStream('Summary for chunk 1'))
      .mockResolvedValueOnce(makeFakeStream('Summary for chunk 2'));

    const result = await generateSummary(logChunks);

    expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      'Summary for chunk 1',
      'Summary for chunk 2'
    ]);
  });

  it('handles empty log chunks', async () => {
    const result = await generateSummary([]);
    
    expect(result).toEqual([]);
    expect(mockGenerateContentStream).not.toHaveBeenCalled();
  });

  it('retries on API failure and succeeds on retry', async () => {
    const logChunks = [
      [{ timestamp: '2023-01-01', level: 'info', message: 'Test log' }]
    ];

    let callCount = 0;
    
    // Fail twice, then succeed on third attempt
    mockGenerateContentStream.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error('API Error'));
      }
      return Promise.resolve(makeFakeStream('Summary after retry'));
    });

    const result = await generateSummary(logChunks);

    expect(mockGenerateContentStream).toHaveBeenCalledTimes(3);
    expect(result).toEqual(['Summary after retry']);
  });

  it('marks segment as failed if all retries fail', { timeout: 10000 }, async () => {
    const logChunks = [
      [{ timestamp: '2023-01-01', level: 'info', message: 'Test log' }]
    ];

    // Directly mock the failure without actual delays
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      cb();
      return 0 as any;
    });

    // Always fail
    mockGenerateContentStream.mockRejectedValue(new Error('API Error'));

    const result = await generateSummary(logChunks);

    // Should have attempted the maximum number of retries (3 by default)
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(3);
    expect(result).toEqual(['❌ Failed to generate summary for this segment']);
  });
}); 