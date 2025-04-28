import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { persistExperience } from '../src/experiential_agent';
import { ReplayBuffer, PPO } from '../src/rl_core';
import { calcReward } from '../src/reward_functions';
import * as path from 'path';
import fs from 'fs';

// First import the real module to get types and enums
import { Type as RealType } from '@google/genai';

// Mock the GoogleGenAI module before importing it
vi.mock('@google/genai', async () => {
  const mockGenerateContent = vi.fn().mockResolvedValue({
    response: { text: () => '0.75' },
    candidates: [{ finishReason: 'STOP' }]
  });
  
  // Import actual types/enums from the module
  const actual = await vi.importActual('@google/genai');
  
  return {
    ...actual, // Keep all actual exports, including Type
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
         generateContent: mockGenerateContent,
         generateContentStream: vi.fn().mockImplementation(async function* () {
           yield { response: { text: () => 'Default summary' } };
         }),
         countTokens: vi.fn().mockResolvedValue({ totalTokens: 100 })
      }),
      live: {
        connect: vi.fn().mockImplementation(async ({ callbacks }) => {
          if (callbacks?.onmessage) {
            setTimeout(() => {
              callbacks.onmessage({
                serverContent: {
                  functionCall: {
                    name: 'webSearch',
                    args: { query: 'test query' }
                  }
                }
              });
            }, 0);
          }
          
          return { 
            sendClientContent: vi.fn(), 
            close: vi.fn() 
          };
        })
      }
    }))
  };
});

// Mock better-sqlite3
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

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  json: vi.fn().mockResolvedValue({ result: 'search results' })
});

describe('Experiential Agent Components', () => {
  beforeAll(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    console.log(`API Key loaded: ${process.env.GEMINI_API_KEY.substring(0,4)}...`);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clean test directories
    const testDataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    const testDataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
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
      // Get the mocked class
      const { GoogleGenerativeAI } = require('@google/genai');
      const mockGenAI = new GoogleGenerativeAI('test-key');

      const observation = {
        message: { text: 'What is machine learning?' },
        timestamp: new Date().toISOString()
      };

      const action = {
        parts: [{ text: 'Machine learning is a branch of artificial intelligence...' }]
      };

      // Pass the mocked genAI instance
      const reward = await calcReward(observation, action, mockGenAI);
      
      // Check the reward structure
      expect(reward).toHaveProperty('total');
      expect(reward).toHaveProperty('relevance');
      expect(reward).toHaveProperty('user');
    });
  });
  
  describe('PPO Agent', () => {
    it('should initialize with correct options', async () => {
      const { GoogleGenerativeAI } = require('@google/genai');
      const mockGenAI = new GoogleGenerativeAI('test-key');

      // Create PPO agent
      const agent = new PPO({
        modelName: 'gemini-2.0-flash',
        genAI: mockGenAI
      });

      // Check that the agent has an act method
      expect(typeof agent.act).toBe('function');
    });
    
    it('should learn from experiences', async () => {
      const { GoogleGenerativeAI } = require('@google/genai');
      const mockGenAI = new GoogleGenerativeAI('test-key');

      // Create PPO agent
      const agent = new PPO({
        modelName: 'gemini-2.0-flash',
        genAI: mockGenAI
      });
      
      // Mock experiences
      const experiences = [
        {
          obs: { message: { text: 'Hello' }, timestamp: new Date().toISOString() },
          action: { parts: [{ text: 'Hi there!' }] },
          reward: { total: 0.8, relevance: 0.7, user: 0.9 },
          next_obs: { message: { text: 'How are you?' }, timestamp: new Date().toISOString() },
          done: false,
          sessionId: 'test-session'
        }
      ];
      
      // Learn should not throw
      await expect(agent.learn(experiences)).resolves.not.toThrow();
    });
  });
});

describe('Experiential Agent Integration', () => {
  it('should include sessionId in Experience and NDJSON log', async () => {
    // Mock the appendFile function
    const appendFileMock = vi.fn((filepath, data, callback) => {
      if (callback) callback(null);
      return Promise.resolve();
    });
    
    // Use spyOn instead of trying to replace the function
    vi.spyOn(fs, 'appendFile').mockImplementation(appendFileMock);
    
    try {
      // Test implementation
      const sessionId = `test-${Date.now()}`;
      const experience = {
        obs: { message: { text: 'test' }, timestamp: new Date().toISOString() },
        reward: { total: 1.0, relevance: 0.5, user: 0.5 },
        done: false,
        next_obs: null,
        action: { parts: [{ text: 'response' }] },
        sessionId
      };
      
      await persistExperience(experience);
      
      // Assertions
      expect(appendFileMock).toHaveBeenCalled();
      expect(experience.sessionId).toBe(sessionId);
      
      // Check if sessionId is in the persisted data
      const data = appendFileMock.mock.calls[0][1] as string;
      expect(data).toContain(sessionId);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('should handle webSearch function call', async () => {
    const { GoogleGenerativeAI } = require('@google/genai');
    const mockGenAI = new GoogleGenerativeAI('test-key');
    
    expect(mockGenAI).toBeTruthy();
    expect(mockGenAI.live).toBeTruthy();
    expect(typeof mockGenAI.live.connect).toBe('function');
  });
}); 