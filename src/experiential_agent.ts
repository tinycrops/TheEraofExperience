import { GoogleGenerativeAI, EnhancedGenerateContentResponse } from '@google/generative-ai';
import { ReplayBuffer, PPO } from './rl_core';
import { calcReward } from './reward_functions';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Mock LiveServerMessage interface for testing
interface LiveServerMessage {
  content?: any;
}

// Helper function to extract observation from message
function extractObservation(msg: LiveServerMessage): any {
  // Extract relevant information from the message
  // This would be customized based on your specific use case
  const content = msg.content || {};
  return {
    message: content,
    timestamp: new Date().toISOString()
  };
}

// Main function to run the experiential agent
export async function runExperientialAgent() {
  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY;
  
  // For demo purposes, we'll use a mock API
  console.log('Using demo mode with mock API responses');
  
  // Create a mock model for testing
  const mockGenerativeAI = {
    getGenerativeModel: () => ({
      generateContent: async () => ({
        response: {
          text: () => "This is a mock response from the model."
        }
      })
    })
  };

  console.log('Initializing experiential agent...');

  // Create a mock session for testing since the live API isn't fully implemented yet
  const mockSession = {
    sendClientContent: (content: any) => {
      console.log('Sent content to client:', JSON.stringify(content).substring(0, 200) + '...');
    },
    close: async () => {
      console.log('Session closed');
    },
    onmessage: (msg: LiveServerMessage) => {},
    onerror: (error: any) => {},
    onclose: () => {}
  };

  // Set up replay buffer and PPO agent
  const buffer = new ReplayBuffer(1e6);
  // @ts-ignore - Using mock for demo
  const agent = new PPO({ modelName: 'gemini-1.5-pro', sdk: mockGenerativeAI });

  // For testing, we'll simulate some messages
  const simulateMessage = (content: any) => {
    if (mockSession.onmessage) {
      mockSession.onmessage({ content });
    }
  };

  // Set up message handler
  mockSession.onmessage = async (msg: LiveServerMessage) => {
    try {
      console.log('Received message:', JSON.stringify(msg).substring(0, 200) + '...');
      
      // Extract observation from message
      const obs = extractObservation(msg);
      
      // Get action from agent
      const action = await agent.act(obs);
      
      // Execute action by sending it to the session
      console.log('Sending action:', JSON.stringify(action).substring(0, 200) + '...');
      mockSession.sendClientContent(action);
      
      // Calculate reward
      const reward = await calcReward(obs, action);
      console.log('Calculated reward:', reward);
      
      // Add transition to replay buffer
      buffer.add({ obs, action, reward });
      
      // Periodically update the agent
      if (buffer.size() % 512 === 0) {
        console.log('Learning from batch...');
        const batch = buffer.sample(2048);
        await agent.learn(batch);
      }
    } catch (error) {
      console.error('Error in message handler:', error);
    }
  };

  // Simulate some initial messages for testing
  setTimeout(() => {
    simulateMessage({ text: "Hello, I need help with a task." });
  }, 1000);

  setTimeout(() => {
    simulateMessage({ text: "Can you search for information about machine learning?" });
  }, 2000);

  // Return the mock session for external management
  return mockSession;
} 