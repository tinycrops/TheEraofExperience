import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv-flow';
import * as path from 'path';

// Load environment variables - explicitly include .env.local
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development',
  default_node_env: 'development',
});

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log('Initializing Gemini API...');
  console.log(`API Key loaded: ${apiKey.substring(0, 5)}...`);
  const genAI = new GoogleGenAI({apiKey});
  
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  console.log(`Using model: ${modelName}`);
  
  try {
    console.log('Sending a test query...');
    const result = await genAI.models.generateContent({
      model: modelName,
      contents: [{ 
        role: 'user',
        parts: [{ text: 'What is reinforcement learning?' }]
      }]
    });
    
    console.log('\nResponse:');
    console.log(result.text);
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing Gemini API:', error);
  }
}

main().catch(console.error); 