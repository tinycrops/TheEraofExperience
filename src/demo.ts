/**
 * Demo script to showcase the experiential agent with sample interactions.
 * This demonstrates how to use the experiential agent with the Gemini API.
 */

import { runExperientialAgent } from './experiential_agent';
import * as readline from 'readline';
import * as dotenv from 'dotenv-flow';

// Load environment variables
dotenv.config();

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
    
    // Set up a graceful shutdown handler
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await session.close();
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
      await session.sendClientContent({ text: userInput });
      
      // Get feedback after agent response
      const feedback = await askQuestion('\nHow helpful was that response? (1-5, or just press Enter to skip): ');
      
      if (feedback && !isNaN(Number(feedback))) {
        const rating = Number(feedback);
        if (rating >= 1 && rating <= 5) {
          console.log(`Thank you for your feedback! (${rating}/5)`);
          // In a real implementation, we would use this feedback to adjust rewards
        }
      }
    }
    
    // Close the session and readline
    console.log('Thank you for using the Experience Era agent!');
    await session.close();
    rl.close();
    
  } catch (error) {
    console.error('Error in demo:', error);
    rl.close();
    process.exit(1);
  }
}

// Run the demo
runDemo().catch(console.error); 