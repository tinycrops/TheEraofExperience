/**
 * Era of Experience Demo
 * 
 * This demo showcases the key principles from "The Era of Experience" paper:
 * 1. Streams: Continuous learning from long-term experience
 * 2. Actions and Observations: Rich interaction with the environment
 * 3. Rewards: Grounded in concrete environmental signals
 * 4. Planning and Reasoning: Focused on real-world consequences
 */

import { GoogleGenAI } from '@google/genai';
import { WorldModel } from './world_model';
import { VectorMemory } from './memory';
import { ExperienceStream, Goal, StreamState, getExperienceStream } from './experience_stream';
import { ExperientialPlanner, Plan } from './experiential_planning';
import { Experience } from './experiential_agent';
import * as dotenv from 'dotenv-flow';
import * as path from 'path';
import { calcReward } from './reward_functions';

// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development',
  default_node_env: 'development',
});

/**
 * Main demo function to showcase the Era of Experience principles
 */
async function runExperienceDemo() {
  console.log("🚀 Starting Era of Experience Demo");
  
  // Initialize Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  
  const genAI = new GoogleGenAI({ apiKey });
  
  // Initialize memory system
  console.log("🧠 Initializing memory system...");
  const memory = new VectorMemory(apiKey);
  
  // Initialize world model
  console.log("🌍 Initializing world model...");
  const worldModel = new WorldModel(genAI, memory);
  
  // Create or load an experience stream
  console.log("🌊 Creating experience stream...");
  const streamId = `demo-stream-${Date.now()}`;
  const experienceStream = await getExperienceStream(streamId, worldModel, memory);
  
  // Initialize the planner
  console.log("📝 Initializing experiential planner...");
  const planner = new ExperientialPlanner(genAI, worldModel, memory);
  
  // Define a goal
  const healthGoal: Goal = {
    id: 'health-improvement-1',
    description: 'Help the user improve their health metrics over 30 days',
    metrics: {
      steps: {
        current: 3000, // Current daily average
        target: 10000, // Target daily average
        weight: 0.4
      },
      sleepHours: {
        current: 6, // Current daily average
        target: 8, // Target daily average
        weight: 0.3
      },
      waterIntake: {
        current: 2, // Current glasses per day
        target: 8, // Target glasses per day
        weight: 0.3
      }
    },
    priority: 8,
    timeframe: {
      start: new Date(),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  };
  
  // Add the goal to the stream
  experienceStream.addGoal(healthGoal);
  console.log("🎯 Added health improvement goal to the stream");
  
  // Run simulation loop
  await runSimulation(genAI, worldModel, experienceStream, planner, healthGoal, streamId);
  
  console.log("✅ Era of Experience Demo completed");
}

/**
 * Simulation of an agent experiencing and learning
 */
async function runSimulation(
  genAI: GoogleGenAI,
  worldModel: WorldModel,
  experienceStream: ExperienceStream,
  planner: ExperientialPlanner,
  goal: Goal,
  streamId: string
) {
  console.log("\n📊 Starting agent simulation with goal:", goal.description);
  
  // Simulated environment state
  const environment = {
    user: {
      name: "Alex",
      age: 35,
      healthMetrics: {
        steps: 3000,
        sleepHours: 6,
        waterIntake: 2,
        weight: 180,
        heartRate: 75
      },
      schedule: {
        wakeTime: "7:00 AM",
        bedTime: "11:30 PM",
        workHours: "9:00 AM - 5:00 PM"
      },
      preferences: {
        exerciseType: "walking, light cardio",
        dietRestrictions: "prefers vegetarian options",
        motivation: "moderate"
      }
    },
    context: {
      time: "8:30 AM",
      day: "Monday",
      weather: "Partly cloudy, 65°F",
      location: "Home"
    }
  };
  
  // Initial observation
  let initialObservation = {
    message: {
      text: "Good morning! I'd like some help improving my health habits over the next month."
    },
    user: environment.user,
    context: environment.context
  };
  
  // Define possible action types
  const possibleActionTypes = [
    { type: 'message', description: 'Send a message to the user' },
    { type: 'reminder', description: 'Set a reminder for the user' },
    { type: 'suggestion', description: 'Make a specific suggestion' },
    { type: 'query', description: 'Ask for more information from the user' },
    { type: 'trackProgress', description: 'Record progress toward goals' }
  ];
  
  // Create a plan
  console.log("\n📝 Creating an initial plan based on the goal...");
  
  // Generate potential actions
  const potentialActions = await planner.generatePotentialActions(
    initialObservation,
    goal,
    possibleActionTypes.map(a => a.type)
  );
  
  console.log(`Generated ${potentialActions.length} potential actions`);
  
  // Create a plan
  const plan = await planner.createPlan(
    initialObservation,
    goal,
    potentialActions,
    5, // Maximum steps
    3  // Look-ahead depth
  );
  
  console.log(`Created plan with ${plan.steps.length} steps`);
  console.log(`Estimated reward: ${plan.estimatedReward.toFixed(2)}`);
  console.log(`Confidence: ${plan.confidence.toFixed(2)}`);
  
  // Get a human-readable explanation of the plan
  const planExplanation = await planner.explainPlan(plan);
  console.log("\n💡 Plan explanation:");
  console.log(planExplanation);
  
  // Simulation loop - execute the plan and learn from experience
  console.log("\n🔄 Executing plan and learning from experience...");
  
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    console.log(`\n▶️ Executing step ${i+1}:`);
    console.log(JSON.stringify(step.action, null, 2));
    
    // Simulate the environment's response
    const simulatedResponse = await simulateEnvironmentResponse(
      environment,
      step.action,
      i
    );
    
    // Calculate grounded reward based on environment response
    const rewardResult = await calcReward(
      initialObservation,
      step.action,
      {
        healthMetrics: {
          stepsIncreased: simulatedResponse.stepsIncreased,
          sleepImproved: simulatedResponse.sleepImproved
        },
        userInteractions: i + 1
      }
    );
    
    console.log(`Environment response: ${simulatedResponse.response}`);
    console.log(`Reward: ${rewardResult.total.toFixed(2)}`);
    console.log('Reward breakdown:', Object.entries(rewardResult.breakdown)
      .map(([k, v]) => `${k}: ${v.toFixed(2)}`)
      .join(', '));
    
    // Update environment based on simulation
    updateEnvironment(environment, simulatedResponse);
    
    // Construct experience object
    const experience: Experience = {
      obs: initialObservation,
      action: step.action,
      reward: rewardResult.total,
      done: i === plan.steps.length - 1,
      next_obs: {
        message: { text: simulatedResponse.response },
        user: { ...environment.user },
        context: { ...environment.context }
      },
      sessionId: streamId
    };
    
    // Add experience to the stream
    await experienceStream.addExperience(experience);
    console.log("✅ Experience added to stream");
    
    // Update the plan based on actual experience
    await planner.updatePlan(plan, i, experience);
    
    // Update the initial observation for the next step
    initialObservation = experience.next_obs;
    
    // Pause between steps
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Show the final status of the stream
  console.log("\n📊 Experience Stream Status:");
  console.log(experienceStream.getStatus());
  
  // Show goal progress
  const goalsWithProgress = experienceStream.getGoalsWithProgress();
  console.log("\n🎯 Goal Progress:");
  for (const goal of goalsWithProgress) {
    console.log(`${goal.description}: ${(goal.progress * 100).toFixed(1)}%`);
    console.log("Metrics:");
    Object.entries(goal.metrics).forEach(([key, metric]) => {
      console.log(`  ${key}: ${metric.current} / ${metric.target}`);
    });
  }
}

/**
 * Simulate environment response to agent actions
 */
async function simulateEnvironmentResponse(
  environment: any,
  action: any,
  stepIndex: number
): Promise<{
  response: string;
  stepsIncreased: boolean;
  sleepImproved: boolean;
  waterIncreased: boolean;
}> {
  // Different responses based on action type
  if (action.type === 'message') {
    if (action.content.text && action.content.text.includes('step')) {
      // Increase steps if agent suggests walking
      environment.user.healthMetrics.steps += 500;
      return {
        response: "That's a good suggestion. I can try to walk more throughout the day. I'll start today!",
        stepsIncreased: true,
        sleepImproved: false,
        waterIncreased: false
      };
    } else if (action.content.text && (action.content.text.includes('sleep') || action.content.text.includes('bedtime'))) {
      // Improve sleep if agent gives sleep advice
      environment.user.healthMetrics.sleepHours += 0.5;
      return {
        response: "You're right, I should try to get to bed earlier. I'll aim for 11:00 PM tonight.",
        stepsIncreased: false,
        sleepImproved: true,
        waterIncreased: false
      };
    } else if (action.content.text && (action.content.text.includes('water') || action.content.text.includes('hydration'))) {
      // Increase water intake if agent suggests drinking more
      environment.user.healthMetrics.waterIntake += 1;
      return {
        response: "I'll try to drink more water throughout the day. Maybe I should get a water bottle with time markers.",
        stepsIncreased: false,
        sleepImproved: false,
        waterIncreased: true
      };
    }
  } else if (action.type === 'reminder') {
    return {
      response: "Thanks for setting that reminder. I'll make sure to follow through when it goes off.",
      stepsIncreased: stepIndex % 2 === 0, // Alternate between success and failure
      sleepImproved: stepIndex % 3 === 0,
      waterIncreased: stepIndex % 2 === 1
    };
  } else if (action.type === 'suggestion') {
    // Simulate positive response to suggestions
    if (action.content.suggestion && action.content.suggestion.includes('morning')) {
      environment.user.healthMetrics.steps += 800;
      return {
        response: "A morning routine sounds great. I'll try that starting tomorrow.",
        stepsIncreased: true,
        sleepImproved: false,
        waterIncreased: false
      };
    } else {
      return {
        response: "That's a helpful suggestion. I'll incorporate it into my routine.",
        stepsIncreased: false,
        sleepImproved: true,
        waterIncreased: false
      };
    }
  } else if (action.type === 'query') {
    // Respond to questions
    return {
      response: "I usually get busy with work and forget about my health goals. Having reminders would help me stay on track.",
      stepsIncreased: false,
      sleepImproved: false,
      waterIncreased: false
    };
  }
  
  // Default response
  return {
    response: "I appreciate your help with my health goals. I'll work on implementing these changes.",
    stepsIncreased: false,
    sleepImproved: false,
    waterIncreased: false
  };
}

/**
 * Update environment based on simulation results
 */
function updateEnvironment(environment: any, simulationResults: any): void {
  // Update the time of day
  const time = environment.context.time.split(':');
  let hour = parseInt(time[0], 10);
  hour = (hour + 2) % 24;
  environment.context.time = `${hour}:${time[1]}`;
  
  // Apply any direct metric changes from the simulation
  if (simulationResults.stepsIncreased) {
    environment.user.healthMetrics.steps += 500;
  }
  
  if (simulationResults.sleepImproved) {
    environment.user.healthMetrics.sleepHours += 0.3;
  }
  
  if (simulationResults.waterIncreased) {
    environment.user.healthMetrics.waterIntake += 1;
  }
  
  // Slightly improve metrics over time to simulate progress
  environment.user.healthMetrics.heartRate = Math.max(
    65,
    environment.user.healthMetrics.heartRate - 0.5
  );
}

// Run the demo
if (require.main === module) {
  runExperienceDemo()
    .catch(console.error);
}

export default runExperienceDemo; 