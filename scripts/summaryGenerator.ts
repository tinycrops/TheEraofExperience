import { GoogleGenAI } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';

// Initialize Gemini API client
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');
  return new GoogleGenAI({ apiKey });
}

// Create a prompt for summarizing a log chunk
function createPrompt(chunk: any[], date: string): string {
  return `
You are analyzing system logs for ${date}. Summarize the following log entries, focusing on:
1. Critical errors and exceptions
2. Performance bottlenecks (response times > 500ms)
3. Unusual access patterns or security concerns
4. System state changes (restarts, config updates)

Format your response in markdown with appropriate headers and bullet points.

LOG ENTRIES:
${JSON.stringify(chunk, null, 2)}
`;
}

// Extract text from a streaming response
async function handleContentStream(stream: AsyncIterable<GenerateContentResponse>): Promise<string> {
  let summaryText = '';
  
  try {
    for await (const response of stream) {
      if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
        summaryText += response.candidates[0].content.parts[0].text;
      }
    }
  } catch (err) {
    console.error('Error processing stream:', err);
    throw err;
  }
  
  return summaryText;
}

// Call API with retry logic
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (retries >= maxRetries) break;
      
      const delay = initialDelay * Math.pow(2, retries);
      console.log(`API call failed, retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
  
  throw lastError;
}

// Generate summary for a single chunk
async function summarizeChunk(chunk: any[], date: string): Promise<string> {
  const ai = getGenAI();
  const prompt = createPrompt(chunk, date);
  
  try {
    const stream = await callWithRetry(() => 
      ai.models.generateContentStream({
        model: 'gemini-2.0-flash',
        contents: prompt
      }), 3);
    
    return await handleContentStream(stream);
  } catch (err) {
    console.error('Failed to summarize chunk:', err);
    return '_Failed to summarize this segment._';
  }
}

// Generate daily summary from all chunks
export async function generateSummary(logChunks: any[][], date: string): Promise<string> {
  console.log(`Generating summary for ${date} with ${logChunks.length} chunks`);
  
  // Handle empty logs case
  if (logChunks.length === 0) {
    return `# System Log Summary for ${date}\n\n## Overview\nNo log entries found for this date.\n\nTotal segments: 0`;
  }
  
  // Process each chunk in parallel
  const summaryPromises = logChunks.map(chunk => summarizeChunk(chunk, date));
  const chunkSummaries = await Promise.all(summaryPromises);
  
  // Combine all summaries into a single document
  return combineChunkSummaries(chunkSummaries, date);
}

// Combine multiple chunk summaries into a cohesive document
function combineChunkSummaries(summaries: string[], date: string): string {
  return `# System Log Summary for ${date}

## Overview
This summary contains ${summaries.length} segments of log data processed on ${new Date().toISOString().slice(0, 10)}.
Total segments: ${summaries.length}

${summaries.map((summary, i) => `## Log Segment ${i+1}\n${summary}`).join('\n\n')}

## Recommendations
${generateRecommendations(summaries)}
`;
}

// Generate recommendations section based on all summaries
function generateRecommendations(summaries: string[]): string {
  // Simple approach: check for common issues in summaries
  const hasErrors = summaries.some(s => s.toLowerCase().includes('error') || s.toLowerCase().includes('exception'));
  const hasPerformance = summaries.some(s => s.toLowerCase().includes('slow') || s.toLowerCase().includes('timeout'));
  const hasWarnings = summaries.some(s => s.toLowerCase().includes('warning'));
  
  let recommendations = [];
  
  if (hasErrors) recommendations.push('- Investigate and resolve reported errors');
  if (hasPerformance) recommendations.push('- Review performance bottlenecks');
  if (hasWarnings) recommendations.push('- Address reported warnings');
  
  if (recommendations.length === 0) {
    recommendations.push('- No specific actions required based on today\'s logs');
  }
  
  return recommendations.join('\n');
} 