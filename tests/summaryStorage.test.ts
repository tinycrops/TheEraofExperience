import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';

// Mock crypto - Provide default export
vi.mock('crypto', () => ({
  default: {
    createHash: () => ({ update: () => ({ digest: () => 'md5hash' }) })
  },
  // Keep named export if it was used elsewhere, though unlikely for createHash
  createHash: () => ({ update: () => ({ digest: () => 'md5hash' }) })
}));

// Mock @google/genai - Keep this, but adjust upload mock later
const mockUpload = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    files: {
      upload: mockUpload
    }
  }))
}));

import * as summaryStorage from '../scripts/summaryStorage';

describe('summaryStorage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.SUMMARY_DIR = '/tmp/summaries';
    // Mock specific fs methods as needed using vi.spyOn below
  });

  it('saves summary locally and returns file path', async () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const filePath = await summaryStorage.saveSummaryLocally('2024-04-27', 'summary');
    expect(filePath).toContain(path.join('data', '2024', '04', '27', 'summary.md'));
    expect(mkdirSpy).toHaveBeenCalled();
    expect(writeFileSpy).toHaveBeenCalled();
    mkdirSpy.mockRestore();
    writeFileSpy.mockRestore();
  });

  it('uploads to cold storage and returns uri/name', async () => {
    // Adjust the mock return value for upload
    mockUpload.mockResolvedValue({ 
      name: 'files/mock-id-123', 
      uri: 'https://generativelanguage.googleapis.com/v1beta/files/mock-id-123' 
    });
    const result = await summaryStorage.uploadToColdStorage('2024-04-27', 'summary');
    // Adjust assertion to check for the expected structure
    expect(result).toHaveProperty('uri');
    expect(result).toHaveProperty('name');
    expect(result.name).toContain('files/');
    expect(result.uri).toContain('https://generativelanguage.googleapis.com/v1beta/files/');
  });

  it('getSummaryIndex returns empty array if file missing', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFile').mockRejectedValue({ code: 'ENOENT' });
    const index = await summaryStorage.getSummaryIndex();
    expect(index).toEqual([]);
    readFileSpy.mockRestore();
  });

  it('getSummaryIndex returns parsed index if file exists', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue('[{"date":"2024-04-27"}]');
    const index = await summaryStorage.getSummaryIndex();
    expect(index).toEqual([{ date: '2024-04-27' }]);
    readFileSpy.mockRestore();
  });

  it('updateSummaryIndex writes updated index atomically', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue('[]');
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const renameSpy = vi.spyOn(fs, 'rename').mockResolvedValue(undefined);
    await summaryStorage.updateSummaryIndex('2024-04-27', 'local.md', 'uri', 'name', 'summary');
    expect(writeFileSpy).toHaveBeenCalled();
    expect(renameSpy).toHaveBeenCalled();
    readFileSpy.mockRestore();
    writeFileSpy.mockRestore();
    renameSpy.mockRestore();
  });

  it('updateSummaryIndex replaces existing entry for date', async () => {
    const readFileSpy = vi.spyOn(fs, 'readFile').mockResolvedValue('[{"date":"2024-04-27","localPath":"old.md"}]');
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    const renameSpy = vi.spyOn(fs, 'rename').mockResolvedValue(undefined);
    await summaryStorage.updateSummaryIndex('2024-04-27', 'local.md', 'uri', 'name', 'summary');
    // Check the arguments passed to writeFile
    expect(writeFileSpy).toHaveBeenCalled();
    const writtenData = writeFileSpy.mock.calls[0][1]; // Get data written
    const writtenIndex = JSON.parse(writtenData as string);
    expect(writtenIndex.length).toBe(1);
    expect(writtenIndex[0].localPath).toBe('local.md');
    readFileSpy.mockRestore();
    writeFileSpy.mockRestore();
    renameSpy.mockRestore();
  });
}); 