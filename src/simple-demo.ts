/**
 * Simple Era of Experience Demo
 * 
 * This demo showcases the key principles from the paper with a minimal implementation:
 * 1. Streams: Continuous learning from long-term experience
 * 2. Actions and Observations: Rich interaction with the environment
 * 3. Rewards: Grounded in concrete environmental signals
 * 4. Planning and Reasoning: Focused on real-world consequences
 */

import { GoogleGenAI } from '@google/genai';
import { WorldModel } from './world_model';
import { VectorMemory } from './memory';
import * as dotenv from 'dotenv-flow';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development',
  default_node_env: 'development',
});

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Simple Experience interface that captures the core elements
 */
interface SimpleExperience {
  observation: any;
  action: any;
  reward: number;
  nextObservation?: any;
}

/**
 * Main demo function to showcase the Era of Experience principles
 */
async function runSimpleDemo() {
  console.log("\n======================================");
  console.log("🚀 Starting Simple Era of Experience Demo");
  console.log("======================================\n");
  
  // Initialize Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  
  const genAI = new GoogleGenAI({ apiKey });
  const model = genAI.models;
  
  console.log("🧠 Initializing memory system...");
  const memory = new VectorMemory(apiKey, 'data/simple_experience.db');
  
  console.log("🌍 Initializing world model...");
  const worldModel = new WorldModel(genAI, memory);
  
  // Simulated environment for a health assistant
  const environment = {
    user: {
      name: "Alex",
      healthMetrics: {
        steps: 3000,     // Current daily average
        sleepHours: 6,   // Current daily average
        waterIntake: 2   // Current glasses per day
      },
      goal: {
        steps: 10000,    // Target
        sleepHours: 8,   // Target
        waterIntake: 8   // Target
      }
    }
  };
  
  // Experience stream - in a real system, this would persist across sessions
  const experiences: SimpleExperience[] = [];
  
  console.log("\n🔄 Demonstrating the four key principles...");
  
  // 1. Streams: Show continuous learning from sequential experiences
  console.log("\n1️⃣ STREAMS: Learning from continuous experience");
  console.log("------------------------------------------------");
  
  const initialObservation = {
    message: "I want to improve my health habits but I struggle to stay consistent.",
    userState: environment.user
  };
  
  console.log("👤 User observation:", initialObservation.message);
  
  // The agent's initial response without any prior experience
  const initialResponse = await generateResponse(
    model, 
    initialObservation, 
    []
  );
  
  console.log("🤖 Agent (initial response):", initialResponse.text);
  
  // Record this experience
  const initialExperience: SimpleExperience = {
    observation: initialObservation,
    action: { text: initialResponse.text },
    reward: 0.5 // neutral reward
  };
  
  experiences.push(initialExperience);
  await memory.addMemory(JSON.stringify(initialExperience), { type: 'initial' });
  
  // 2. Actions and Observations: Demonstrate grounded actions beyond just text
  console.log("\n2️⃣ ACTIONS & OBSERVATIONS: Rich grounding in the environment");
  console.log("-----------------------------------------------------------");
  
  const secondObservation = {
    message: "I think I need a specific plan to follow. What should I do tomorrow?",
    userState: environment.user
  };
  
  console.log("👤 User observation:", secondObservation.message);
  
  // The agent now has access to tools/actions
  const secondResponse = await generateResponseWithActions(
    model, 
    secondObservation, 
    experiences
  );
  
  console.log("🤖 Agent (with actions):", secondResponse.text);
  console.log("🛠️ Recommended actions:", JSON.stringify(secondResponse.actions, null, 2));
  
  // 3. Rewards: Demonstrate grounded rewards
  console.log("\n3️⃣ REWARDS: Grounded in real-world outcomes");
  console.log("-------------------------------------------");
  
  // Simulate the user following the advice (partially)
  const updatedUser = {
    ...environment.user,
    healthMetrics: {
      steps: 5000,      // Improved from 3000
      sleepHours: 6.5,  // Slight improvement
      waterIntake: 4    // Some improvement
    }
  };
  
  // Calculate a grounded reward based on actual improvements
  const rewardValue = calculateGroundedReward(
    environment.user.healthMetrics,
    updatedUser.healthMetrics,
    environment.user.goal
  );
  
  console.log("📊 User followed advice partially and metrics improved");
  console.log("📈 Updated metrics:", JSON.stringify(updatedUser.healthMetrics, null, 2));
  console.log("🏆 Grounded reward:", rewardValue.toFixed(2), "based on actual health improvements");
  
  // Record this experience with the grounded reward
  const secondExperience: SimpleExperience = {
    observation: secondObservation,
    action: { 
      text: secondResponse.text,
      actions: secondResponse.actions
    },
    reward: rewardValue,
    nextObservation: {
      message: "I followed some of your advice.",
      userState: updatedUser
    }
  };
  
  experiences.push(secondExperience);
  await memory.addMemory(JSON.stringify(secondExperience), { type: 'action' });
  
  // 4. Planning: Using world model to predict outcomes of different actions
  console.log("\n4️⃣ PLANNING: Reasoning about consequences using a world model");
  console.log("-----------------------------------------------------------");
  
  const thirdObservation = {
    message: "What should I focus on improving first?",
    userState: updatedUser
  };
  
  console.log("👤 User observation:", thirdObservation.message);
  
  // Generate potential alternative actions
  const potentialActions = [
    { focus: "steps", plan: "Start with a walking program of 30 minutes daily" },
    { focus: "sleep", plan: "Focus on establishing a consistent sleep schedule" },
    { focus: "water", plan: "Set reminders to drink water throughout the day" }
  ];
  
  console.log("🧠 Agent evaluating potential actions using world model...");
  
  // Use world model to predict outcomes for each action
  const predictions = await Promise.all(
    potentialActions.map(async (action) => {
      const prediction = await worldModel.predictNextState(thirdObservation, action);
      return {
        action,
        predictedReward: prediction.predictedReward,
        confidence: prediction.confidence
      };
    })
  );
  
  // Sort by predicted reward * confidence
  predictions.sort((a, b) => 
    (b.predictedReward * b.confidence) - (a.predictedReward * a.confidence)
  );
  
  console.log("🧮 Predicted outcomes:");
  predictions.forEach((p, i) => {
    console.log(`   ${i+1}. Focus on ${p.action.focus}: Predicted reward ${p.predictedReward.toFixed(2)}, Confidence ${p.confidence.toFixed(2)}`);
  });
  
  // Choose the best action
  const bestAction = predictions[0].action;
  console.log("🎯 Selected best action:", JSON.stringify(bestAction, null, 2));
  
  // Generate final response considering the best action
  const finalResponse = await generatePlannedResponse(
    model,
    thirdObservation,
    experiences,
    bestAction
  );
  
  console.log("🤖 Agent (with planning):", finalResponse);
  
  console.log("\n✅ Simple Era of Experience Demo completed");
  console.log("This demo showed how an agent can:");
  console.log("1. Maintain a continuous stream of experience");
  console.log("2. Take richly grounded actions beyond just text");
  console.log("3. Learn from rewards based on real-world outcomes");
  console.log("4. Plan using a world model that predicts consequences");
}

/**
 * Generate a simple text response
 */
async function generateResponse(model: any, observation: any, experiences: SimpleExperience[]) {
  const context = experiences.length > 0 
    ? `\n\nPast experiences: ${JSON.stringify(experiences)}` 
    : '';
  
  const result = await model.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [{ text: `You are a health assistant that learns from experience. 
      
The user has provided the following information:
${JSON.stringify(observation, null, 2)}
${context}

Provide a helpful response.`}]
    }]
  });
  
  return { text: result.text };
}

/**
 * Generate a response that includes recommended actions
 */
async function generateResponseWithActions(model: any, observation: any, experiences: SimpleExperience[]) {
  const context = experiences.length > 0 
    ? `\n\nPast experiences: ${JSON.stringify(experiences)}` 
    : '';
  
  const result = await model.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [{ text: `You are a health assistant that learns from experience.
      
The user has provided the following information:
${JSON.stringify(observation, null, 2)}
${context}

Provide a helpful response AND a JSON array of 3 specific action recommendations for the user.
In your response, include both a conversational answer AND a JSON array of actions. 
Format each action as: {"type": "activity", "description": "description of activity"}

Format your entire response as a JSON object with two fields: "text" (your conversational response) and "actions" (the array of action objects).`}]
    }]
  });
  
  try {
    // Parse the JSON response
    const responseText = result.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
    const parsedResponse = JSON.parse(jsonStr);
    
    return {
      text: parsedResponse.text || responseText,
      actions: parsedResponse.actions || []
    };
  } catch (e) {
    // If parsing fails, return just the text
    return {
      text: result.text,
      actions: []
    };
  }
}

/**
 * Generate a response that incorporates planning
 */
async function generatePlannedResponse(model: any, observation: any, experiences: SimpleExperience[], bestAction: any) {
  const context = experiences.length > 0 
    ? `\n\nPast experiences: ${JSON.stringify(experiences)}` 
    : '';
  
  const result = await model.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{
      role: 'user',
      parts: [{ text: `You are a health assistant that learns from experience and uses planning.
      
The user has provided the following information:
${JSON.stringify(observation, null, 2)}
${context}

Based on careful analysis, I've determined that the following is the most promising action:
${JSON.stringify(bestAction, null, 2)}

Write a response to the user that focuses on this recommended action. Explain why this is the best approach based on their current metrics and goals. Be conversational and encouraging.`}]
    }]
  });
  
  return result.text;
}

/**
 * Calculate a grounded reward based on actual improvement in health metrics
 */
function calculateGroundedReward(previous: any, current: any, goals: any): number {
  let totalReward = 0;
  let metricCount = 0;
  
  // Calculate improvement for each metric as a percentage of the goal
  for (const [key, value] of Object.entries(current)) {
    if (key in previous && key in goals) {
      const prevValue = previous[key] as number;
      const goalValue = goals[key] as number;
      const currentValue = value as number;
      
      // Calculate normalized improvement toward goal
      const prevGap = Math.abs(goalValue - prevValue);
      const currentGap = Math.abs(goalValue - currentValue);
      
      // If goal is to increase
      if (goalValue > prevValue) {
        const improvement = currentValue - prevValue;
        const normalizedImprovement = improvement / (goalValue - prevValue);
        totalReward += Math.min(1, Math.max(-0.5, normalizedImprovement));
      } 
      // If goal is to decrease
      else {
        const improvement = prevValue - currentValue;
        const normalizedImprovement = improvement / (prevValue - goalValue);
        totalReward += Math.min(1, Math.max(-0.5, normalizedImprovement));
      }
      
      metricCount++;
    }
  }
  
  // Average reward across all metrics, scaled from -1 to 1
  return metricCount > 0 ? totalReward / metricCount : 0;
}

// Run the demo
if (require.main === module) {
  runSimpleDemo().catch(error => {
    console.error("Error running demo:", error);
  });
} 