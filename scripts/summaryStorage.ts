import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');
  return new GoogleGenAI({ apiKey });
}

export async function saveSummaryLocally(date: string, summary: string): Promise<string> {
  const [year, month, day] = date.split('-');
  const dir = path.join('data', year, month, day);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'summary.md');
  await fs.writeFile(filePath, summary, 'utf8');
  return filePath;
}

export async function uploadToColdStorage(date: string, summary: string): Promise<{ uri: string, name: string }> {
  const ai = getGenAI();
  const file = new Blob([summary], { type: 'text/markdown' });
  const response = await withRetry(() => ai.files.upload({ file, config: { displayName: `summary_${date}.md` } }), 3, 2000);
  if (!response.uri || !response.name) throw new Error('Upload failed: missing uri or name');
  return { uri: response.uri, name: response.name };
}

export async function getSummaryIndex(): Promise<any[]> {
  const indexPath = path.join('data', 'summaries_index.json');
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    return JSON.parse(data);
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

export async function updateSummaryIndex(date: string, localPath: string, remoteUri: string, remoteName: string, summary: string): Promise<void> {
  const indexPath = path.join('data', 'summaries_index.json');
  const now = new Date().toISOString();
  const checksum = calculateChecksum(summary);
  let index = await getSummaryIndex();
  // Remove any existing entry for this date
  index = index.filter((e: any) => e.date !== date);
  index.push({
    date,
    localPath,
    coldStorageUri: remoteUri,
    coldStorageName: remoteName,
    byteSize: Buffer.byteLength(summary, 'utf8'),
    createdAt: now,
    lastUpdatedAt: now,
    uploadAttempts: 1,
    uploadSuccess: !!remoteUri,
    checksum,
  });
  // Write atomically
  const tempFile = indexPath + '.tmp';
  await fs.writeFile(tempFile, JSON.stringify(index, null, 2));
  await fs.rename(tempFile, indexPath);
}

function calculateChecksum(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        const jitter = Math.random() * 0.3 + 0.85;
        await new Promise(r => setTimeout(r, delay * Math.pow(2, attempt-1) * jitter));
      }
    }
  }
  throw lastError;
} 