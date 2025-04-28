// @ts-nocheck
import { Experience } from '../src/experiential_agent';
import { ReplayBuffer, PPO } from '../src/rl_core';
import { calcReward } from '../src/reward_functions';
import * as dotenv from 'dotenv-flow';

// Mock the GoogleGenAI module
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: '0.75' // Mock score for reward calculation as property
          }),
          countTokens: jest.fn().mockResolvedValue({ totalTokens: 100 })
        },
        live: {
          connect: jest.fn().mockResolvedValue({
            sendClientContent: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined)
          })
        }
      };
    }),
    Modality: {
      TEXT: 'TEXT'
    }
  };
});

// Mock fs module
jest.mock('fs', () => {
  return {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    appendFile: jest.fn((path, data, callback) => callback(null))
  };
});

describe('Experiential Agent Components', () => {
  beforeAll(() => {
    // Mock environment variables
    process.env.GEMINI_API_KEY = 'fake-api-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
  });

  describe('ReplayBuffer', () => {
    it('should add experiences and maintain size', () => {
      const buffer = new ReplayBuffer(3);
      
      // Add experiences
      const exp1 = { obs: { value: 1 }, reward: 0.5, done: false };
      const exp2 = { obs: { value: 2 }, reward: 0.7, done: false };
      const exp3 = { obs: { value: 3 }, reward: 0.9, done: false };
      const exp4 = { obs: { value: 4 }, reward: 1.0, done: false };
      
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
      const exp1 = { obs: { value: 1 }, reward: 0.5, done: false };
      const exp2 = { obs: { value: 2 }, reward: 0.7, done: false };
      
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
      const { GoogleGenAI } = jest.requireActual('@google/genai');
      
      // Create mock genAI client
      const mockGenAI = new GoogleGenAI({apiKey: 'fake-key'});
      
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
      const { GoogleGenAI } = jest.requireActual('@google/genai');
      
      // Create mock genAI client
      const mockGenAI = new GoogleGenAI({apiKey: 'fake-key'});
      
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
          done: false
        },
        {
          obs: { message: { text: 'test2' }, timestamp: new Date().toISOString() },
          action: { parts: [{ text: 'response2' }] },
          reward: 0.3,
          done: false
        }
      ];
      
      // Learning shouldn't throw an error
      await expect(agent.learn(experiences)).resolves.not.toThrow();
    });
  });
}); 