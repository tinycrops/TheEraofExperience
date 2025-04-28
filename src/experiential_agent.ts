import { GoogleGenAI, Content, Modality } from '@google/genai';
import { ReplayBuffer, PPO } from './rl_core';
import { calcReward } from './reward_functions';
import * as dotenv from 'dotenv-flow';
import * as fs from 'fs';
import * as path from 'path';

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
}

// Helper function to extract observation from message
function extractObservation(msg: LiveServerMessage): any {
  if (!msg.serverContent) {
    return {
      message: { text: '' },
      timestamp: new Date().toISOString()
    };
  }

  // Extract relevant information from the message
  return {
    message: msg.serverContent,
    timestamp: new Date().toISOString()
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
async function persistExperience(experience: Experience): Promise<void> {
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

// Main function to run the experiential agent
export async function runExperientialAgent() {
  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  console.log(`Initializing experiential agent with model ${modelName}...`);

  // Initialize the real Google GenAI client
  const genAI = new GoogleGenAI({apiKey});
  
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
      // Define tools when needed:
      // tools: [{
      //   functionDeclarations: [
      //     {
      //       name: 'webSearch',
      //       description: 'Search the web for information',
      //       parameters: {
      //         type: 'object',
      //         properties: {
      //           query: {
      //             type: 'string',
      //             description: 'The search query'
      //           }
      //         },
      //         required: ['query']
      //       }
      //     }
      //   ]
      // }]
    },
    callbacks: {
      // Handle server messages (observations)
      onmessage: async (msg: LiveServerMessage) => {
        try {
          console.log('Received message');
          
          // Extract observation from message (first pillar: streams of experience)
          const obs = extractObservation(msg);
          
          // Record the observation for later use
          currentObs = obs;
          
          // Get action from agent
          const action = await agent.act(obs);
          
          // Execute action by sending it to the session (second pillar: autonomous actions)
          console.log('Sending action');
          await session.sendClientContent(action);
          
          // Calculate reward (third pillar: grounded rewards)
          const reward = await calcReward(obs, action);
          console.log('Calculated reward:', reward);
          
          // Create experience object
          const experience: Experience = {
            obs,
            reward,
            done: false, // For ongoing conversations
            next_obs: null, // Will be filled in later
            action: action
          };
          
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

  // Return the session for external management
  return session;
} 