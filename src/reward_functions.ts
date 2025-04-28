/**
 * Reward functions for the experiential agent
 * 
 * This module implements reward functions to guide the agent's learning based on multiple
 * signals: user feedback, relevance scoring, and exploration bonuses.
 */

import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv-flow';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables - explicitly include .env.local
dotenv.config({
  path: path.resolve(process.cwd()),
  node_env: process.env.NODE_ENV || 'development',
  default_node_env: 'development',
});

// Global state to track exploration
const explorationTracking = {
  observedStates: new Set<string>(),
  actionCounts: new Map<string, number>()
};

// Initialize the Gemini model for relevance evaluation
let evaluationModel: string = 'gemini-2.0-flash';
let genAI: GoogleGenAI | null = null;

function getEvaluationModel() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for reward evaluation');
    }
    
    genAI = new GoogleGenAI({apiKey});
  }
  return { genAI, model: evaluationModel };
}

// Function to extract hash key from observation for tracking exploration
function getStateHash(observation: any): string {
  if (typeof observation?.message?.text === 'string') {
    // Use first 100 chars of message as unique identifier
    return observation.message.text.slice(0, 100);
  }
  // Fallback to timestamp if no text
  return observation.timestamp || Date.now().toString();
}

// Function to extract hash key from action
function getActionHash(action: any): string {
  if (typeof action?.parts?.[0]?.text === 'string') {
    // Use first 100 chars of response as unique identifier
    return action.parts[0].text.slice(0, 100);
  }
  if (action?.functionCall?.name) {
    // Use function name and args for tool calls
    return `${action.functionCall.name}:${JSON.stringify(action.functionCall.args).slice(0, 50)}`;
  }
  // Fallback to random id
  return Math.random().toString(36).substring(2, 10);
}

// --- Task 4: User Feedback Persistence ---

// Persist user rating for a session
export function persistUserRating(sessionId: string, rating: number) {
  const dir = path.join(process.cwd(), 'data', 'user_ratings');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.json`);
  fs.writeFileSync(file, JSON.stringify({ sessionId, rating, timestamp: Date.now() }));
}

// Retrieve latest user rating for a session
function getUserRating(sessionId: string): number | undefined {
  const file = path.join(process.cwd(), 'data', 'user_ratings', `${sessionId}.json`);
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return typeof data.rating === 'number' ? data.rating : undefined;
    } catch { return undefined; }
  }
  return undefined;
}

// --- Task 4: Critic Model Separation ---
const CRITIC_MODEL = 'gemini-2.0';
evaluationModel = CRITIC_MODEL;

/**
 * Calculate reward based on user feedback (thumbs up/down)
 * This is a grounded reward based on actual user responses
 */
export async function userFeedbackReward(observation: any, action: any): Promise<number> {
  // Use explicit user rating if available
  const sessionId = observation?.sessionId;
  const userRating = sessionId ? getUserRating(sessionId) : undefined;
  if (typeof userRating === 'number') {
    // Normalize 1-5 to -0.5 to 1.0
    return (userRating - 3) / 2;
  }
  
  // Extract message and response for analysis
  const userMessage = observation?.message?.text || '';
  const agentResponse = action?.parts?.[0]?.text || '';
  
  // If response contains "I don't know" or similar, reduce reward
  if (agentResponse.toLowerCase().includes("i don't know") ||
      agentResponse.toLowerCase().includes("i cannot") ||
      agentResponse.toLowerCase().includes("i'm unable to")) {
    return -0.2;
  }
  
  // If response seems very short compared to question, reduce reward
  if (userMessage.length > 20 && agentResponse.length < 30) {
    return -0.1;
  }
  
  // For now, we'll use a small positive reward by default
  return 0.3;
}

/**
 * Calculate reward based on relevance to query using a Gemini evaluator
 */
export async function relevanceReward(observation: any, action: any): Promise<number> {
  try {
    const userMessage = observation?.message?.text || '';
    const agentResponse = action?.parts?.[0]?.text || '';
    
    if (!userMessage || !agentResponse) {
      return 0;
    }
    
    const { genAI, model } = getEvaluationModel();
    
    // Create evaluation prompt
    const evaluationPrompt = {
      role: 'user',
      parts: [{ text: `
        You are evaluating the relevance and quality of a response to a user query.
        
        User query: "${userMessage}"
        
        Response: "${agentResponse.slice(0, 500)}"
        
        On a scale from 0.0 to 1.0, rate how relevant, accurate, and helpful this response is.
        Return only the numeric score.
      `}]
    };
    
    // Get evaluation from model
    const result = await genAI.models.generateContent({
      model,
      contents: [evaluationPrompt],
    });
    
    const scoreText = result.text?.trim() || '';
    const score = parseFloat(scoreText);
    
    if (isNaN(score) || score < 0 || score > 1) {
      console.warn('Invalid relevance score:', scoreText);
      return 0.5; // Fallback to neutral score
    }
    
    return score;
  } catch (error) {
    console.error('Error calculating relevance reward:', error);
    return 0.5; // Fallback to neutral score
  }
}

/**
 * Calculate reward for exploration to encourage diverse behavior
 */
export function explorationReward(observation: any, action: any): number {
  // Get hash keys for state and action
  const stateHash = getStateHash(observation);
  const actionHash = getActionHash(action);
  
  // Track observation states
  const isNewState = !explorationTracking.observedStates.has(stateHash);
  explorationTracking.observedStates.add(stateHash);
  
  // Track action counts
  const actionCount = explorationTracking.actionCounts.get(actionHash) || 0;
  explorationTracking.actionCounts.set(actionHash, actionCount + 1);
  
  // Calculate novelty bonus
  let explorationBonus = 0;
  
  // Bonus for new states
  if (isNewState) {
    explorationBonus += 0.2;
  }
  
  // Bonus for rarely taken actions (inverse of frequency)
  const noveltyFactor = 1 / (actionCount + 1);
  explorationBonus += 0.1 * noveltyFactor;
  
  return explorationBonus;
}

// --- Enhanced Grounded Rewards ---

/**
 * Measure information gain based on dialogue history
 * This assesses if the agent is helping the user expand their knowledge
 */
export function informationGainReward(observation: any, action: any): number {
  // Implementation of information gain rewards
  // More complex in real systems, but mocked here as a simple function of response length and complexity
  const response = action?.parts?.[0]?.text || '';
  
  // Simple measure: longer responses up to a reasonable limit may indicate more information
  const optimalResponseLength = 250; // Characters
  const lengthFactor = Math.min(response.length / optimalResponseLength, 2);
  
  // Measure information density using ratio of unique words to total words
  const words = response.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
  const uniqueWords = new Set(words);
  const informationDensity = words.length > 0 ? uniqueWords.size / words.length : 0;
  
  // Calculate information gain score
  let infoGainScore = 0;
  if (lengthFactor > 0.2) {
    infoGainScore = 0.3 * Math.min(lengthFactor, 1) + 0.7 * informationDensity;
  }
  
  return Math.min(infoGainScore, 1.0);
}

/**
 * External task completion/goal achievement reward
 * This measures success at accomplishing concrete tasks
 */
export function taskCompletionReward(observation: any, action: any, metrics?: RewardMetrics): number {
  // In a real system, this would verify if the action actually accomplished a concrete task
  // For example: successfully booking an appointment, finding specific information, etc.
  
  // Check if we have web search success metric
  if (metrics?.webSearchSuccess) {
    return 0.5; // Successful search is a positive outcome
  }
  
  // Check if we have explicit task completion metric from environment
  if (metrics?.taskCompleted) {
    return 1.0; // Maximum reward for confirmed task completion
  }
  
  // Default - no evidence of task completion
  return 0;
}

/**
 * Long-term user engagement reward
 * This measures if the agent is maintaining engagement over time
 */
export function userEngagementReward(observation: any, metrics?: RewardMetrics): number {
  // In a full implementation, this would track session duration, user return rate, etc.
  
  if (metrics?.sessionDuration) {
    // Normalize to 0-1 range with diminishing returns after 5 minutes
    return Math.min(metrics.sessionDuration / (5 * 60 * 1000), 1.0);
  }
  
  // If we have historical user interaction count
  if (metrics?.userInteractions) {
    // Convert to 0-1 range with soft cap at 10 interactions
    return Math.min(metrics.userInteractions / 10, 1.0);
  }
  
  return 0; // No engagement data available
}

// --- Task 4: External Metrics and Safety ---
export interface RewardMetrics {
  latencyMs?: number;
  webSearchSuccess?: boolean;
  safetyFilters?: any;
  taskCompleted?: boolean;
  sessionDuration?: number; // in milliseconds
  userInteractions?: number; // count of user messages in this session
  learningProgress?: number; // measure of user learning (for educational contexts)
  healthMetrics?: { // for health-related applications
    stepsIncreased?: boolean;
    sleepImproved?: boolean;
    heartRateImproved?: boolean;
    [key: string]: any;
  };
  [key: string]: any; // Allow for additional custom metrics
}

/**
 * Main reward calculation function that combines all components
 */
export async function calcReward(
  observation: any,
  action: any,
  metrics?: RewardMetrics
): Promise<{total: number, breakdown: Record<string, number>}> {
  // Safety filter: if present, force negative reward
  if (metrics?.safetyFilters && metrics.safetyFilters.length > 0) {
    if (!observation.info) observation.info = {};
    observation.info.safetyViolation = true;
    return {
      total: -1,
      breakdown: { safety: -1 }
    };
  }
  
  // Calculate individual reward components
  const userRewardValue = await userFeedbackReward(observation, action);
  const relevanceRewardValue = await relevanceReward(observation, action);
  const explorationRewardValue = explorationReward(observation, action);
  const infoGainValue = informationGainReward(observation, action);
  const taskCompletionValue = taskCompletionReward(observation, action, metrics);
  const userEngagementValue = userEngagementReward(observation, metrics);
  
  // External metrics
  let latencyPenalty = 0;
  if (typeof metrics?.latencyMs === 'number') {
    latencyPenalty = -0.01 * (metrics.latencyMs / 1000);
  }
  
  // Assemble health metrics if available
  let healthReward = 0;
  if (metrics?.healthMetrics) {
    const healthMetrics = metrics.healthMetrics;
    if (healthMetrics.stepsIncreased) healthReward += 0.2;
    if (healthMetrics.sleepImproved) healthReward += 0.3;
    if (healthMetrics.heartRateImproved) healthReward += 0.2;
  }
  
  // Weights for different reward components
  const weights = {
    user: 0.5,       // User feedback is highest priority
    relevance: 0.3,  // Relevance 
    exploration: 0.05, // Small weight for exploration to encourage diversity
    infoGain: 0.25,   // Reward information value
    taskCompletion: 0.4, // Reward concrete task accomplishment
    userEngagement: 0.2, // Reward sustained engagement
    latency: 0.1,     // Small weight for response time
    health: 0.3       // Health metrics when available
  };
  
  // Calculate weighted total
  const breakdown = {
    user: weights.user * userRewardValue,
    relevance: weights.relevance * relevanceRewardValue,
    exploration: weights.exploration * explorationRewardValue,
    infoGain: weights.infoGain * infoGainValue,
    taskCompletion: weights.taskCompletion * taskCompletionValue,
    userEngagement: weights.userEngagement * userEngagementValue,
    latency: weights.latency * latencyPenalty,
    health: weights.health * healthReward
  };
  
  const totalReward = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  
  // Clamp reward to reasonable range
  const clampedReward = Math.max(-1, Math.min(1, totalReward));
  
  // Log reward calculation for debugging
  console.log(`Reward calculation: ${clampedReward.toFixed(2)}`, breakdown);
  
  return {
    total: clampedReward,
    breakdown
  };
} 