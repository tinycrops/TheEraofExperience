"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSummary = generateSummary;
const genai_1 = require("@google/genai");
// Create a function to replace generateContentStream
async function createStreamingGenerator(apiKey) {
    const genAI = new genai_1.GoogleGenAI({ apiKey });
    return async function streamContent({ model, contents, generationConfig }) {
        const geminiModel = genAI.models;
        // Only pass the basic parameters that we know are supported
        return await geminiModel.generateContentStream({
            model,
            contents
        });
    };
}
// Helper to create retry logic around API calls
async function callWithRetry(fn, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            console.error(`Attempt ${attempt + 1}/${maxRetries} failed:`, error);
            // Wait longer between retries
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    // If we get here, all retries failed
    throw lastError;
}
// Process a single chunk of logs into a summary
async function processChunk(chunk) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    const streamGenerator = await createStreamingGenerator(process.env.GEMINI_API_KEY);
    const prompt = `Summarize these system logs with focus on errors, warnings, and important events:
  ${JSON.stringify(chunk, null, 2)}`;
    try {
        const result = await callWithRetry(() => streamGenerator({
            model: 'gemini-2.0-flash',
            contents: [{ text: prompt }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048
            }
        }));
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
    }
    catch (error) {
        console.error('Failed to generate summary:', error);
        return '❌ Failed to generate summary for this segment';
    }
}
/**
 * Generate summaries for a set of log chunks
 * @param logChunks Array of log chunk arrays
 * @returns Array of generated summaries (one per chunk)
 */
async function generateSummary(logChunks) {
    if (logChunks.length === 0) {
        return [];
    }
    // Process each chunk in parallel
    const summaryPromises = logChunks.map(chunk => processChunk(chunk));
    return Promise.all(summaryPromises);
}
//# sourceMappingURL=summaryGenerator.js.map