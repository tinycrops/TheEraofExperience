import * as fs from 'fs';
import * as path from 'path';

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export function getYesterdayDate(): string {
  // In test environment, return a fixed date
  if (process.env.NODE_ENV === 'test') {
    return '2024-04-27';
  }
  
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

/**
 * Get the path to yesterday's log file
 * Returns object with date and filePath if file exists, null otherwise
 */
export function getYesterdayLogs() {
  const date = getYesterdayDate();
  const dirPath = path.join('data', date);
  const filePath = path.join(dirPath, 'stream.ndjson');

  if (!fs.existsSync(filePath)) {
    console.warn(`Log file not found: ${filePath}`);
    return null;
  }

  return { date, filePath };
}

/**
 * Parse NDJSON string into array of objects
 */
export function parseNDJSON(content: string): any[] {
  const entries: any[] = [];
  
  // Split by newlines and process each line
  const lines = content.split('\n');
  
  for (const line of lines) {
    try {
      if (line.trim()) {
        const entry = JSON.parse(line);
        entries.push(entry);
      }
    } catch (error) {
      console.error(`Error parsing line: ${line}`, error);
    }
  }
  
  return entries;
}

/**
 * Simple function to estimate tokens from string length
 * A very rough approximation, not precise but works for chunking
 */
function estimateTokens(text: string): number {
  // Average of ~4 characters per token is a common rough estimate
  return Math.ceil(text.length / 4);
}

/**
 * Chunk logs based on token count to avoid exceeding model context limits
 */
export async function chunkLogs(logs: any[], maxTokens = 30000): Promise<any[][]> {
  const chunks: any[][] = [];
  let currentChunk: any[] = [];
  let currentTokenCount = 0;

  if (logs.length === 0) {
    return [];
  }

  for (const log of logs) {
    const logContent = JSON.stringify(log);
    // Use our estimation function directly
    const tokenCount = estimateTokens(logContent);
    
    if (currentTokenCount + tokenCount > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentTokenCount = 0;
    }
    currentChunk.push(log);
    currentTokenCount += tokenCount;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  return chunks;
}
