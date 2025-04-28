import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv-flow';

// Load environment variables
dotenv.config();

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log('Initializing Gemini API...');
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