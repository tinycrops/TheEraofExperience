// scripts/logProcessor.ts
// Module for processing and chunking daily NDJSON logs for summarization
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

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
 * Parse NDJSON log file
 */
export async function parseNDJSON(filePath: string): Promise<any[]> {
  const entries: any[] = [];
  
  const lineReader = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });
  
  for await (const line of lineReader) {
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

// Helper to instantiate Gemini SDK
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');
  return new GoogleGenAI({ apiKey });
}

// Accurate token-based chunking using Gemini SDK
export async function chunkLogs(logs: any[], maxTokens = 30000): Promise<any[][]> {
  const ai = getGenAI();
  const chunks: any[][] = [];
  let currentChunk: any[] = [];
  let currentTokenCount = 0;

  for (const log of logs) {
    const logContent = JSON.stringify(log);
    let tokenCount = 0;
    try {
      const result = await ai.models.countTokens({ model: 'gemini-2.0-flash', contents: logContent });
      tokenCount = result.totalTokens || 0;
    } catch (err) {
      // Fallback: estimate tokens as chars/4
      tokenCount = Math.ceil(logContent.length / 4);
      console.warn('Token counting failed, using estimate for log:', err);
    }
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

// TODO: Add error handling, logging, and tests for all functions 