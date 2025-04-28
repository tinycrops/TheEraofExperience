/**
 * Demo script to showcase the experiential agent with sample interactions.
 * This demonstrates how to use the experiential agent with the Gemini API.
 */

import { runExperientialAgent } from './experiential_agent';
import * as readline from 'readline';
import * as dotenv from 'dotenv-flow';
import * as path from 'path';
import { persistUserRating } from './reward_functions';

// Load environment variables - explicitly include .env.local
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development',
  default_node_env: 'development',
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask a question and get a response
function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function runDemo() {
  console.log('---- The Era of Experience Agent Demo ----');
  console.log('This demo shows how an agent can learn from experiences over time.');
  console.log('The agent will respond to your messages and learn from the interactions.');
  console.log('Type "exit" or press Ctrl+C to end the demo.');
  console.log('-----------------------------------------');
  
  try {
    // Initialize the experiential agent
    console.log('Initializing experiential agent...');
    const session = await runExperientialAgent();
    
    // Since we don't get a sessionId from the session object anymore, generate our own
    const demoSessionId = `demo-${Date.now()}`;
    console.log(`Using demo session ID: ${demoSessionId}`);
    
    // Set up a graceful shutdown handler
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      if (session) {
        await session.close();
      }
      rl.close();
      process.exit(0);
    });
    
    // Sample queries to demonstrate the agent
    const sampleQueries = [
      "What is reinforcement learning?",
      "How does an agent learn from experience?",
      "What are the key components of the Era of Experience approach?",
      "How can I implement a reward function?",
      "What's the difference between RL and supervised learning?"
    ];
    
    console.log('\nSuggested queries:');
    sampleQueries.forEach((query, index) => {
      console.log(`${index + 1}. ${query}`);
    });
    
    // Main interaction loop
    let interacting = true;
    while (interacting) {
      console.log('\n');
      const userInput = await askQuestion('You: ');
      
      if (userInput.toLowerCase() === 'exit') {
        interacting = false;
        continue;
      }
      
      // Send the user message to the session
      if (session && typeof session.sendClientContent === 'function') {
        await session.sendClientContent({ text: userInput });
      } else {
        console.log('Warning: Cannot send message - session or sendClientContent is not available');
      }
      
      // AUTOMATED: Generate random feedback rating (1-5) and persist
      const rating = Math.floor(Math.random() * 5) + 1;
      console.log(`(Automated) Feedback: ${rating}/5`);
      if (demoSessionId) {
        persistUserRating(demoSessionId, rating);
      }
    }
    
    // Close the session and readline
    console.log('Thank you for using the Experience Era agent!');
    if (session && typeof session.close === 'function') {
      await session.close();
    }
    rl.close();
    
  } catch (error) {
    console.error('Error in demo:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the demo
runDemo().catch(console.error); 