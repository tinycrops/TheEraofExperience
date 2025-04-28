import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../scripts/logProcessor', () => ({
  getYesterdayLogs: vi.fn(),
  parseNDJSON: vi.fn(),
  chunkLogs: vi.fn(),
}));
vi.mock('../scripts/summaryGenerator', () => ({
  generateSummary: vi.fn(),
}));
vi.mock('../scripts/summaryStorage', () => ({
  saveSummaryLocally: vi.fn(),
  uploadToColdStorage: vi.fn(),
  updateSummaryIndex: vi.fn(),
}));

import * as summarizationJob from '../scripts/summarizationJob';
import * as logProcessor from '../scripts/logProcessor';
import * as summaryGenerator from '../scripts/summaryGenerator';
import * as summaryStorage from '../scripts/summaryStorage';

describe('summarizationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the full pipeline successfully', async () => {
    (logProcessor.getYesterdayLogs as any).mockReturnValue({ date: '2024-04-27', filePath: 'data/2024-04-27/stream.ndjson' });
    (logProcessor.parseNDJSON as any).mockResolvedValue([{ msg: 'a' }, { msg: 'b' }]);
    (logProcessor.chunkLogs as any).mockResolvedValue([[{ msg: 'a' }], [{ msg: 'b' }]]);
    (summaryGenerator.generateSummary as any).mockResolvedValue('summary text');
    (summaryStorage.saveSummaryLocally as any).mockResolvedValue('data/2024-04-27/summary.md');
    (summaryStorage.uploadToColdStorage as any).mockResolvedValue({ uri: 'uri', name: 'name' });
    (summaryStorage.updateSummaryIndex as any).mockResolvedValue(undefined);
    await summarizationJob.main();
    expect(logProcessor.getYesterdayLogs).toHaveBeenCalled();
    expect(logProcessor.parseNDJSON).toHaveBeenCalled();
    expect(logProcessor.chunkLogs).toHaveBeenCalled();
    expect(summaryGenerator.generateSummary).toHaveBeenCalled();
    expect(summaryStorage.saveSummaryLocally).toHaveBeenCalled();
    expect(summaryStorage.uploadToColdStorage).toHaveBeenCalled();
    expect(summaryStorage.updateSummaryIndex).toHaveBeenCalled();
  });

  it('exits gracefully if no log file', async () => {
    (logProcessor.getYesterdayLogs as any).mockReturnValue(null);
    await summarizationJob.main();
    expect(logProcessor.parseNDJSON).not.toHaveBeenCalled();
  });

  it('exits gracefully if no log entries', async () => {
    (logProcessor.getYesterdayLogs as any).mockReturnValue({ date: '2024-04-27', filePath: 'data/2024-04-27/stream.ndjson' });
    (logProcessor.parseNDJSON as any).mockResolvedValue([]);
    await summarizationJob.main();
    expect(logProcessor.chunkLogs).not.toHaveBeenCalled();
  });

  it('handles upload failure and still updates index', async () => {
    (logProcessor.getYesterdayLogs as any).mockReturnValue({ date: '2024-04-27', filePath: 'data/2024-04-27/stream.ndjson' });
    (logProcessor.parseNDJSON as any).mockResolvedValue([{ msg: 'a' }]);
    (logProcessor.chunkLogs as any).mockResolvedValue([[{ msg: 'a' }]]);
    (summaryGenerator.generateSummary as any).mockResolvedValue('summary text');
    (summaryStorage.saveSummaryLocally as any).mockResolvedValue('data/2024-04-27/summary.md');
    (summaryStorage.uploadToColdStorage as any).mockRejectedValue(new Error('fail'));
    (summaryStorage.updateSummaryIndex as any).mockResolvedValue(undefined);
    await summarizationJob.main();
    expect(summaryStorage.updateSummaryIndex).toHaveBeenCalledWith(
      '2024-04-27',
      'data/2024-04-27/summary.md',
      '',
      '',
      'summary text'
    );
  });
}); 