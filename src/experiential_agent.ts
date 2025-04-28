import { GoogleGenAI, Content, Modality, Type } from '@google/genai';
import { ReplayBuffer, PPO } from './rl_core';
import { calcReward, RewardMetrics } from './reward_functions';
import * as dotenv from 'dotenv-flow';
import * as fs from 'fs';
import * as path from 'path';
import { VectorMemory } from './memory';

// Load environment variables - explicitly include .env.local
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development',
  default_node_env: 'development',
});

// Log API key (first few characters only for security)
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
  console.log(`API Key loaded: ${apiKey.substring(0, 5)}...`);
} else {
  console.warn('API Key not found in environment variables!');
}

// Define types to match the new SDK
interface LiveServerMessage {
  serverContent?: any;
  [key: string]: any;
}

interface LiveSession {
  sendClientContent: (content: any) => void;
  close: () => void;
}

// Experience interface to abstract environment interactions
export interface Experience {
  obs: any;                // Observation from the environment
  reward: number;          // Reward signal
  done: boolean;           // Whether this is a terminal state
  next_obs?: any;          // Next observation (optional)
  info?: Record<string, any>; // Additional information (optional)
  action?: any;            // Action taken by the agent
  sessionId: string;       // Unique session identifier
}

// Helper function to extract observation from message
function extractObservation(msg: LiveServerMessage, sessionId?: string): any {
  if (!msg.serverContent) {
    return {
      message: { text: '' },
      timestamp: new Date().toISOString(),
      sessionId
    };
  }
  // Extract relevant information from the message
  return {
    message: msg.serverContent,
    timestamp: new Date().toISOString(),
    sessionId
  };
}

// Ensure data directory exists
function ensureDataDirectory() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const dir = path.join(process.cwd(), 'data', dateStr);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  return path.join(dir, 'stream.ndjson');
}

// Function to save experience to NDJSON file
export async function persistExperience(experience: Experience): Promise<void> {
  const filepath = ensureDataDirectory();
  const serialized = JSON.stringify(experience) + '\n';
  return new Promise((resolve, reject) => {
    fs.appendFile(filepath, serialized, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Token counter for managing context size
async function tokenCost(ai: GoogleGenAI, contents: Content[]): Promise<number> {
  try {
    // With the new SDK, the token counting is not directly available
    // We'll use a simple estimation method as fallback
    return JSON.stringify(contents).length / 4;
  } catch (error) {
    console.error('Error counting tokens:', error);
    // Fallback estimate if the API call fails
    return JSON.stringify(contents).length / 4;
  }
}

// Retry helper for API calls
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries - 1) throw e;
      const waitTime = 2 ** i * 200;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error('All retries failed');
}

// Exported handler for testability
export async function handleLiveMessage({
  msg,
  session,
  buffer,
  agent,
  sessionId,
  persistExperience,
  vectorMemory
}: {
  msg: LiveServerMessage,
  session: LiveSession,
  buffer: any,
  agent: any,
  sessionId: string,
  persistExperience: (exp: Experience) => Promise<void>,
  vectorMemory: any
}) {
  console.log('DEBUG: Entered onmessage callback', msg);
  try {
    console.log('Received message');
    // --- Task 3: Tool Use ---
    if (msg.serverContent && msg.serverContent.functionCall) {
      const { functionCall } = msg.serverContent;
      if (functionCall.name === 'webSearch') {
        const args = functionCall.args || {};
        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        const query = encodeURIComponent(args.query || '');
        const url = `https://www.googleapis.com/customsearch/v1?q=${query}&key=${GOOGLE_API_KEY}`;
        console.log('DEBUG: About to call fetch with URL:', url); // Debug log
        const start = Date.now();
        const fetchResult = await fetch(url);
        const latencyMs = Date.now() - start;
        const webSearchSuccess = fetchResult.status === 200;
        const resultJson = await fetchResult.json();
        // Stream back the result (truncate to 8k chars)
        await session.sendClientContent({
          parts: [{ text: JSON.stringify(resultJson).slice(0, 8000) }]
        });
        // Re-run calcReward after tool result
        const obs = extractObservation(msg, sessionId);
        const action = { parts: [{ text: JSON.stringify(resultJson).slice(0, 8000) }] };
        const metrics: RewardMetrics = { latencyMs, webSearchSuccess };
        const reward = await calcReward(obs, action, metrics);
        const experience: Experience = {
          obs,
          reward,
          done: false,
          next_obs: null,
          action,
          sessionId: sessionId,
          info: { webSearchSuccess, latencyMs }
        };
        buffer.add(experience);
        await persistExperience(experience);
        return;
      }
    }
    // --- End Task 3: Tool Use ---
    // Handle file/image modality
    if (msg.clientContent && msg.clientContent.inlineData) {
      const { createPartFromUri } = await import('@google/genai');
      const part = createPartFromUri(
        msg.clientContent.inlineData.data,
        msg.clientContent.inlineData.mimeType
      );
      // You may want to use this part in further processing or pass to agent.act
      // For now, just log it
      console.log('Received inlineData part:', part);
    }
    // Extract observation from message (first pillar: streams of experience)
    const obs = extractObservation(msg, sessionId);
    // --- Vector Memory Integration ---
    try {
      await vectorMemory.addMemory(obs.message.text || '', obs.timestamp, obs.message);
      const topMemories = await vectorMemory.querySimilar(obs.message.text || '', 5);
      console.log('Top similar memories:', topMemories.map((m: any) => m.text));
      // Optionally: pass topMemories to agent.act if agent supports it
    } catch (memErr) {
      console.error('VectorMemory error:', memErr);
    }
    // --- End Vector Memory Integration ---
    // Get action from agent
    const action = await agent.act(obs);
    // Execute action by sending it to the session (second pillar: autonomous actions)
    console.log('Sending action');
    await session.sendClientContent(action);
    // Calculate reward (third pillar: grounded rewards)
    let metrics: RewardMetrics = {};
    // Safety filter: check for safetyFilters in serverContent
    if (msg.serverContent && msg.serverContent.safetyFilters && msg.serverContent.safetyFilters.length > 0) {
      metrics.safetyFilters = msg.serverContent.safetyFilters;
    }
    const reward = await calcReward(obs, action, metrics);
    console.log('Calculated reward:', reward);
    // Create experience object
    const experience: Experience = {
      obs,
      reward,
      done: false, // For ongoing conversations
      next_obs: null, // Will be filled in later
      action: action,
      sessionId: sessionId,
      info: {}
    };
    // Attach userRating if available
    if (obs.sessionId) {
      const userRatingsPath = path.join(process.cwd(), 'data', 'user_ratings', `${obs.sessionId}.json`);
      if (fs.existsSync(userRatingsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(userRatingsPath, 'utf-8'));
          if (typeof data.rating === 'number') {
            if (!experience.info) experience.info = {};
            experience.info.userRating = data.rating;
          }
        } catch {}
      }
    }
    // Attach safetyViolation if present
    if (metrics.safetyFilters && metrics.safetyFilters.length > 0) {
      if (!experience.info) experience.info = {};
      experience.info.safetyViolation = true;
    }
    // Add experience to replay buffer
    buffer.add(experience);
    // Persist experience to disk
    await persistExperience(experience);
    // Periodically update the agent (fourth pillar: planning/reasoning)
    if (buffer.size() % 32 === 0) {
      console.log('Learning from batch...');
      const batch = buffer.sample(128);
      await agent.learn(batch);
    }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
}

// Main function to run the experiential agent
export async function runExperientialAgent() {
  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  console.log(`Initializing experiential agent with model ${modelName}...`);

  // Generate a unique session ID (e.g., ISO timestamp + random hex)
  const sessionId = `${new Date().toISOString()}-${Math.random().toString(16).slice(2, 10)}`;
  console.log(`Session ID: ${sessionId}`);

  // Initialize the real Google GenAI client
  const genAI = new GoogleGenAI({apiKey});
  
  // Persistent vector memory
  const vectorMemory = new VectorMemory(apiKey);

  // Create replay buffer and PPO agent
  const buffer = new ReplayBuffer(1e6);
  const agent = new PPO({ 
    modelName: modelName, 
    genAI: genAI
  });

  // Connect to Live API
  console.log('Connecting to Gemini Live API...');
  
  let currentObs: any = null;
  let session: LiveSession;

  // Create live session
  session = await genAI.live.connect({
    model: modelName,
    config: {
      responseModalities: [Modality.TEXT],
      tools: [{
        functionDeclarations: [
          {
            name: 'webSearch',
            description: 'SERP',
            parameters: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING }
              },
              required: ['query']
            }
          }
        ]
      }]
    },
    callbacks: {
      onmessage: async (msg: LiveServerMessage) => {
        await handleLiveMessage({
          msg,
          session,
          buffer,
          agent,
          sessionId,
          persistExperience,
          vectorMemory
        });
      },
      onopen: () => {
        console.log('Session opened successfully');
      },
      onerror: (error: any) => {
        console.error('Session error:', error);
      },
      onclose: () => {
        console.log('Session closed');
      }
    }
  });

  // Attach sessionId for demo wiring
  (session as any).sessionId = sessionId;
  return session;
} 