import { GoogleGenAI } from '@google/genai';

// Create a function to replace generateContentStream
async function createStreamingGenerator(apiKey: string) {
  const genAI = new GoogleGenAI({ apiKey });
  return async function streamContent({ model, contents, generationConfig }: {
    model: string,
    contents: Array<{ text: string }>,
    generationConfig?: any
  }) {
    const geminiModel = genAI.models;
    // Only pass the basic parameters that we know are supported
    return await geminiModel.generateContentStream({
      model,
      contents
    });
  };
}

// Helper to create retry logic around API calls
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error);
      
      // Wait longer between retries
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}

// Process a single chunk of logs into a summary
async function processChunk(chunk: any[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const streamGenerator = await createStreamingGenerator(process.env.GEMINI_API_KEY);
  const prompt = `Summarize these system logs with focus on errors, warnings, and important events:
  ${JSON.stringify(chunk, null, 2)}`;

  try {
    const result = await callWithRetry(() => 
      streamGenerator({
        model: 'gemini-2.0-flash',
        contents: [{ text: prompt }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048
        }
      })
    );

    // Process the stream
    let summary = '';
    for await (const chunk of result) {
      if (chunk && chunk.candidates && chunk.candidates[0]?.content?.parts) {
        const parts = chunk.candidates[0].content.parts;
        for (const part of parts) {
          if (part.text) {
            summary += part.text;
          }
        }
      }
    }
    
    return summary;
  } catch (error) {
    console.error('Failed to generate summary:', error);
    return '❌ Failed to generate summary for this segment';
  }
}

/**
 * Generate summaries for a set of log chunks
 * @param logChunks Array of log chunk arrays
 * @returns Array of generated summaries (one per chunk)
 */
export async function generateSummary(logChunks: any[][]): Promise<string[]> {
  if (logChunks.length === 0) {
    return [];
  }

  // Process each chunk in parallel
  const summaryPromises = logChunks.map(chunk => processChunk(chunk));
  return Promise.all(summaryPromises);
}
