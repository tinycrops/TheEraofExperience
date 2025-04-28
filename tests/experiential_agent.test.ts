import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Experience } from '../src/experiential_agent';
import { ReplayBuffer, PPO } from '../src/rl_core';
import { calcReward } from '../src/reward_functions';
import * as dotenv from 'dotenv-flow';
import * as path from 'path';

// Configure dotenv to load .env.local
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'test',
  default_node_env: 'test',
});

// Use the real API key from .env.local for mocks
const apiKey = process.env.GEMINI_API_KEY;

// Mock the GoogleGenAI module and Type enum at the very top
let onConnectResolve = null;

vi.mock('@google/genai', () => {
  const sessionSendClientContent = vi.fn();
  const mockSession = { sendClientContent: sessionSendClientContent, close: vi.fn() };
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: '0.75' // Mock score for reward calculation as property
          }),
          countTokens: vi.fn().mockResolvedValue({ totalTokens: 100 })
        },
        live: {
          connect: vi.fn().mockImplementation(async ({ callbacks }) => {
            setImmediate(async () => {
              await callbacks.onmessage({
                serverContent: {
                  functionCall: {
                    name: 'webSearch',
                    args: { query: 'test query' }
                  }
                }
              });
              if (typeof onConnectResolve === 'function') {
                setImmediate(onConnectResolve);
              }
            });
            return mockSession;
          })
        }
      };
    }),
    Modality: {
      TEXT: 'TEXT'
    },
    Type: {
      OBJECT: 'object',
      STRING: 'string'
    }
  };
});

// Mock fetch globally at the top
(global as any).fetch = vi.fn().mockResolvedValue({
  json: vi.fn().mockResolvedValue({ result: 'search results' })
});

// Mock fs module
vi.mock('fs', () => {
  return {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    appendFile: vi.fn((path, data, callback) => callback(null))
  };
});

// Mock better-sqlite3 to avoid native dependency issues in tests
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: vi.fn()
      }),
      pragma: vi.fn(),
      exec: vi.fn()
    }))
  };
});

describe('Experiential Agent Components', () => {
  beforeAll(() => {
    // Use the real API key from .env.local
    process.env.GEMINI_API_KEY = apiKey;
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Warning: No API key found in environment variables for tests');
    }
  });

  describe('ReplayBuffer', () => {
    it('should add experiences and maintain size', () => {
      const buffer = new ReplayBuffer(3);
      
      // Add experiences
      const exp1 = { obs: { value: 1 }, reward: 0.5, done: false, sessionId: 'test' };
      const exp2 = { obs: { value: 2 }, reward: 0.7, done: false, sessionId: 'test' };
      const exp3 = { obs: { value: 3 }, reward: 0.9, done: false, sessionId: 'test' };
      const exp4 = { obs: { value: 4 }, reward: 1.0, done: false, sessionId: 'test' };
      
      buffer.add(exp1);
      expect(buffer.size()).toBe(1);
      
      buffer.add(exp2);
      expect(buffer.size()).toBe(2);
      
      buffer.add(exp3);
      expect(buffer.size()).toBe(3);
      
      // Adding a 4th experience should replace the oldest one
      buffer.add(exp4);
      expect(buffer.size()).toBe(3);
      
      // Sample should return experiences
      const samples = buffer.sample(3);
      expect(samples.length).toBe(3);
    });
    
    it('should update next_obs correctly', () => {
      const buffer = new ReplayBuffer(5);
      
      // Add consecutive experiences
      const exp1 = { obs: { value: 1 }, reward: 0.5, done: false, sessionId: 'test' };
      const exp2 = { obs: { value: 2 }, reward: 0.7, done: false, sessionId: 'test' };
      
      buffer.add(exp1);
      buffer.add(exp2);
      
      // Sample and check if next_obs was updated
      const samples = buffer.sample(2);
      const exp1InBuffer = samples.find(e => e.obs.value === 1);
      
      // exp1 should have exp2's obs as next_obs
      expect(exp1InBuffer?.next_obs?.value).toBe(2);
    });
  });
  
  describe('Reward Functions', () => {
    it('should calculate combined reward', async () => {
      const observation = { 
        message: { text: 'What is machine learning?' },
        timestamp: new Date().toISOString()
      };
      
      const action = { 
        parts: [{ text: 'Machine learning is a branch of artificial intelligence focused on building systems that learn from data.' }]
      };
      
      const reward = await calcReward(observation, action);
      
      // The reward should be a number between -1 and 1
      expect(typeof reward).toBe('number');
      expect(reward).toBeGreaterThanOrEqual(-1);
      expect(reward).toBeLessThanOrEqual(1);
    });
  });
  
  describe('PPO Agent', () => {
    it('should initialize with correct options', async () => {
      // Import the actual GoogleGenAI for typings
      const { GoogleGenAI } = await vi.importActual('@google/genai') as any;
      
      // Create mock genAI client with real API key
      const mockGenAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
      
      // Create PPO agent
      const agent = new PPO({
        modelName: 'gemini-2.0-flash',
        genAI: mockGenAI
      });
      
      // Check that the agent has an act method
      expect(typeof agent.act).toBe('function');
      
      // Test that act returns an action
      const obs = { message: { text: 'test' }, timestamp: new Date().toISOString() };
      const action = await agent.act(obs);
      
      // Action should have parts array
      expect(action).toHaveProperty('parts');
    });
    
    it('should learn from experiences', async () => {
      // Import the actual GoogleGenAI for typings
      const { GoogleGenAI } = await vi.importActual('@google/genai') as any;
      
      // Create mock genAI client with real API key
      const mockGenAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
      
      // Create PPO agent
      const agent = new PPO({
        modelName: 'gemini-2.0-flash',
        genAI: mockGenAI
      });
      
      // Create sample experiences
      const experiences = [
        {
          obs: { message: { text: 'test1' }, timestamp: new Date().toISOString() },
          action: { parts: [{ text: 'response1' }] },
          reward: 0.8,
          done: false,
          sessionId: 'test',
        },
        {
          obs: { message: { text: 'test2' }, timestamp: new Date().toISOString() },
          action: { parts: [{ text: 'response2' }] },
          reward: 0.3,
          done: false,
          sessionId: 'test',
        }
      ];
      
      // Learning shouldn't throw an error
      await expect(agent.learn(experiences)).resolves.not.toThrow();
    }, 20000);
  });
});

describe('Experiential Agent Integration', () => {
  it('should include sessionId in Experience and NDJSON log', async () => {
    console.log('DEBUG: Starting sessionId NDJSON log test');
    try {
      // Import persistExperience function
      const { persistExperience } = await import('../src/experiential_agent');
      // Create a fake sessionId
      const sessionId = 'test-session-1234';
      // Create a sample experience
      const experience = {
        obs: { message: { text: 'hello' }, timestamp: new Date().toISOString() },
        reward: 1.0,
        done: false,
        next_obs: null,
        action: { parts: [{ text: 'world' }] },
        sessionId: sessionId
      };
      // Mock fs.appendFile to capture the written data
      const fs = await import('fs');
      let writtenData = '';
      vi.spyOn(fs, 'appendFile').mockImplementation((path, data, cb) => {
        writtenData = data as string;
        cb(null);
      });
      await persistExperience(experience);
      console.log('DEBUG: Written NDJSON:', writtenData);
      // Check that the written NDJSON includes the sessionId
      expect(writtenData).toContain(sessionId);
      // Check that the written NDJSON is valid JSON per line
      const parsed = JSON.parse(writtenData.trim());
      expect(parsed.sessionId).toBe(sessionId);
      expect(parsed.obs.message.text).toBe('hello');
      expect(parsed.action.parts[0].text).toBe('world');
      console.log('DEBUG: sessionId NDJSON log test passed');
    } catch (err) {
      console.error('DEBUG: sessionId NDJSON log test error', err);
      throw err;
    }
  });
});

describe('Experiential Agent Tool Use', () => {
  vi.setConfig({ testTimeout: 20000 }); // Increase timeout for this suite
  it('should handle webSearch functionCall, call fetch, and log result to NDJSON', async () => {
    console.log('DEBUG: Starting tool use test');
    const { handleLiveMessage } = await import('../src/experiential_agent');
    const sessionSendClientContent = vi.fn();
    const mockSession = { sendClientContent: sessionSendClientContent, close: vi.fn() };
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ result: 'search results' })
    });
    // Spy on persistExperience
    const persistSpy = vi.fn();
    // Mock buffer and agent
    const mockBuffer = { add: vi.fn(), size: () => 1, sample: () => [] };
    const mockAgent = { act: vi.fn().mockResolvedValue({ parts: [{ text: 'agent response' }] }) };
    const mockVectorMemory = { addMemory: vi.fn(), querySimilar: vi.fn().mockResolvedValue([]) };
    // Prepare mock message
    const msg = {
      serverContent: {
        functionCall: {
          name: 'webSearch',
          args: { query: 'test query' }
        }
      }
    };
    // Act
    await handleLiveMessage({
      msg,
      session: mockSession,
      buffer: mockBuffer,
      agent: mockAgent,
      sessionId: 'test-session-1234',
      persistExperience: persistSpy,
      vectorMemory: mockVectorMemory
    });
    // Assert
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('q=test%20query'));
    expect(sessionSendClientContent).toHaveBeenCalledWith({
      parts: [expect.objectContaining({ text: expect.stringContaining('search results') })]
    });
    expect(persistSpy).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({ parts: [expect.objectContaining({ text: expect.stringContaining('search results') })] })
    }));
    console.log('DEBUG: tool use test passed');
  });
}); 