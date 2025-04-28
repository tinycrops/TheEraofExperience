import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the modules first
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  createReadStream: vi.fn(),
}));

vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  countTokens: vi.fn().mockResolvedValue({ totalTokens: 10 }),
}));

// Import modules and get references to mocks
import * as fs from 'fs';
import { countTokens } from '@google/genai';

// Import functions after mocking
import { getYesterdayLogs, parseNDJSON, chunkLogs } from '../src/logProcessor';

// Get typed mock
const mockExistsSync = vi.mocked(fs.existsSync);
const mockCountTokens = vi.mocked(countTokens);

describe('logProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getYesterdayLogs', () => {
    it('returns null if yesterday file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      
      const result = getYesterdayLogs();
      expect(result).toBeNull();
      expect(mockExistsSync).toHaveBeenCalled();
    });

    it('returns file info if yesterday file exists', () => {
      mockExistsSync.mockReturnValue(true);
      
      const result = getYesterdayLogs();
      expect(result).toEqual({
        date: '2024-04-27',
        filePath: expect.stringContaining('stream.ndjson')
      });
      expect(mockExistsSync).toHaveBeenCalled();
    });
  });

  describe('parseNDJSON', () => {
    it('parses valid NDJSON lines', () => {
      const input = `{"msg":"Log 1","level":"info"}
{"msg":"Log 2","level":"warn"}`;
      
      const result = parseNDJSON(input);
      expect(result).toEqual([
        { msg: "Log 1", level: "info" },
        { msg: "Log 2", level: "warn" }
      ]);
    });

    it('skips empty lines', () => {
      const input = `{"msg":"Log 1","level":"info"}

{"msg":"Log 2","level":"warn"}`;
      
      const result = parseNDJSON(input);
      expect(result).toEqual([
        { msg: "Log 1", level: "info" },
        { msg: "Log 2", level: "warn" }
      ]);
    });

    it('returns empty array for empty input', () => {
      const result = parseNDJSON('');
      expect(result).toEqual([]);
    });

    it('skips malformed JSON lines', () => {
      const input = `{"msg":"Log 1","level":"info"}
invalid json
{"msg":"Log 2","level":"warn"}`;
      
      const result = parseNDJSON(input);
      expect(result).toEqual([
        { msg: "Log 1", level: "info" },
        { msg: "Log 2", level: "warn" }
      ]);
    });
  });

  describe('chunkLogs', () => {
    it('chunks logs based on token count', async () => {
      const logs = [
        { msg: 'Log 1' },
        { msg: 'Log 2' },
        { msg: 'Log 3' },
      ];
      
      // Make sure countTokens returns values that will cause chunking
      mockCountTokens.mockImplementation(() => {
        return Promise.resolve({ totalTokens: 12 });
      });
      
      const result = await chunkLogs(logs, 25);
      
      // With 12 tokens per log and 25 max, we should get 2+ chunks
      expect(result.length).toBeGreaterThan(1);
    });

    it('handles empty logs array', async () => {
      const result = await chunkLogs([]);
      expect(result).toEqual([]);
    });

    it('puts all logs in one chunk if they fit', async () => {
      const logs = [
        { msg: 'Log 1' },
        { msg: 'Log 2' },
      ];
      
      mockCountTokens.mockResolvedValue({ totalTokens: 5 });
      
      const result = await chunkLogs(logs, 30);
      
      expect(result.length).toBe(1);
      expect(result[0]).toEqual(logs);
    });
  });
}); 