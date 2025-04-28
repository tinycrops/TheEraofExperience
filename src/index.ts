import { runExperientialAgent } from './experiential_agent';
import * as dotenv from 'dotenv-flow';
import * as path from 'path';

// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development',
  default_node_env: 'development',
});

// Entry point for the application
async function main() {
  console.log('Starting The Era of Experience Agent...');
  console.log('Implementing concepts from the paper:');
  console.log('1. Learning from continuous streams of experience');
  console.log('2. Grounded actions and observations through tool use');
  console.log('3. Grounded rewards based on real-world outcomes');
  console.log('4. Planning using a world model trained from experience');
  
  try {
    // Run the experiential agent
    const session = await runExperientialAgent();
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      if (session && typeof session.close === 'function') {
        await session.close();
      }
      process.exit(0);
    });
    
    // Keep the process running for the simulated messages
    console.log('Agent is running. Press Ctrl+C to exit.');
    
    // For demo purposes, keep the process alive for a while
    // In a real application, this would run indefinitely
    console.log('This demo will automatically exit after 60 seconds');
    setTimeout(() => {
      console.log('Demo complete. Exiting...');
      process.exit(0);
    }, 60000);
  } catch (error) {
    console.error('Error running experiential agent:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 