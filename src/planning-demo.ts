/**
 * Planning demo for The Era of Experience agent
 * 
 * This demo shows how an experiential agent can plan sequences of actions
 * to achieve goals, using a world model that learns from experience.
 */

import { GoogleGenAI, Content } from '@google/genai';
import dotenv from 'dotenv-flow';
import * as path from 'path';
import { VectorMemory } from './memory';
import { WorldModel } from './world_model';

// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development'
});

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  console.error('GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

// Simple function to create a simulated experience
function createExperience(observation: any, action: any, nextObs: any, reward: number) {
  return {
    obs: observation,
    action: action,
    next_obs: nextObs,
    reward: { total: reward },
    done: false,
    sessionId: `demo-${Date.now()}`
  };
}

async function runPlanningDemo() {
  console.log('Starting The Era of Experience Planning Demo...');
  
  // Initialize Google GenAI client
  const genAI = new GoogleGenAI({ apiKey });
  
  // Initialize vector memory for the world model
  const vectorMemory = new VectorMemory(apiKey, 'data/planning_demo.db');
  
  // Initialize world model
  const worldModel = new WorldModel(genAI, vectorMemory, 'gemini-2.0-flash');
  
  // Seed the world model with some example experiences for learning
  console.log('Seeding world model with example experiences...');
  
  // Scenario 1: Web search for quantum computing
  const exp1 = createExperience(
    { message: { text: "What is quantum computing?" } },
    { functionCall: { name: 'webSearch', args: { query: 'quantum computing basics' } } },
    { message: { text: "Found information about quantum computing from reputable sources." } },
    0.8
  );
  await worldModel.update(exp1);
  
  // Scenario 2: Direct explanation of a topic
  const exp2 = createExperience(
    { message: { text: "Explain how quantum computing differs from classical computing." } },
    { parts: [{ text: "Quantum computing differs from classical computing in several key ways. In classical computing, information is processed in bits (0s and 1s). In quantum computing, information is processed in quantum bits or 'qubits' that can exist in multiple states simultaneously thanks to superposition..." }] },
    { message: { text: "That was helpful, thank you!" } },
    0.9
  );
  await worldModel.update(exp2);
  
  // Scenario 3: Unsuccessful web search
  const exp3 = createExperience(
    { message: { text: "What's the weather like today?" } },
    { functionCall: { name: 'webSearch', args: { query: 'current weather' } } },
    { message: { text: "I'm sorry, I couldn't retrieve the current weather information." } },
    0.2
  );
  await worldModel.update(exp3);
  
  // Scenario 4: Step-by-step tutorial
  const exp4 = createExperience(
    { message: { text: "How does quantum entanglement work?" } },
    { parts: [{ text: "Let me explain quantum entanglement step by step:\n\n1. Entanglement is a quantum phenomenon where two or more particles become correlated in such a way that the quantum state of each particle cannot be described independently.\n\n2. When particles are entangled, whatever happens to one particle can affect the other, no matter the distance between them.\n\n3. This happens because their quantum states are fundamentally linked during the entanglement process." }] },
    { message: { text: "That makes it much clearer, thanks!" } },
    0.95
  );
  await worldModel.update(exp4);
  
  console.log('World model seeded with example experiences.');
  
  // Define some queries to test planning
  const testQueries = [
    "I want to understand quantum computing basics",
    "Can you help me learn about machine learning?",
    "I need to prepare for a physics test about relativity",
    "What's the best way to learn about climate change?"
  ];
  
  // Define possible actions for planning
  const possibleActions = [
    { parts: [{ text: "I'll provide a comprehensive explanation about the topic" }] },
    { parts: [{ text: "Let me break this down into steps..." }] },
    { functionCall: { name: 'webSearch', args: { query: 'PLACEHOLDER' } } },
    { parts: [{ text: "I'll compare and contrast this with related concepts" }] }
  ];
  
  // Test planning for each query
  for (const query of testQueries) {
    console.log(`\n\n=== Planning for query: "${query}" ===`);
    
    // Create observation from query
    const observation = {
      message: { text: query },
      timestamp: new Date().toISOString(),
      sessionId: `demo-${Date.now()}`
    };
    
    // Customize possible actions for this specific query
    const customizedActions = possibleActions.map(action => {
      if (action.functionCall?.name === 'webSearch') {
        return {
          functionCall: {
            name: 'webSearch',
            args: { query: query }
          }
        };
      }
      return action;
    });
    
    // Plan actions using world model
    console.log('Planning actions...');
    const plannedActions = await worldModel.planActions(observation, customizedActions, 3);
    
    // Display the plan
    console.log(`\nPlanned ${plannedActions.length} actions:`);
    for (let i = 0; i < plannedActions.length; i++) {
      const action = plannedActions[i];
      if (action.parts && action.parts[0]?.text) {
        console.log(`${i+1}. Text response: "${action.parts[0].text.substring(0, 100)}..."`);
      } else if (action.functionCall) {
        console.log(`${i+1}. Function call: ${action.functionCall.name}(${JSON.stringify(action.functionCall.args)})`);
      } else {
        console.log(`${i+1}. Unknown action type: ${JSON.stringify(action).substring(0, 100)}...`);
      }
    }
    
    // Predict the outcomes of the first planned action
    const firstAction = plannedActions[0];
    if (firstAction) {
      console.log('\nPredicting outcome of first planned action...');
      const prediction = await worldModel.predictNextState(observation, firstAction);
      
      console.log(`\nPredicted outcome:`);
      console.log(`- Expected reward: ${prediction.predictedReward.toFixed(2)}`);
      console.log(`- Confidence: ${prediction.confidence.toFixed(2)}`);
      console.log(`- Predicted next observation: ${JSON.stringify(prediction.predictedObs).substring(0, 150)}...`);
    }
  }
  
  console.log('\nPlanning demo complete');
}

// Run the demo
runPlanningDemo().catch(error => {
  console.error('Error in planning demo:', error);
  process.exit(1);
});