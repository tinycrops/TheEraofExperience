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
 * In a real application, this would track actual user feedback
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
      config: { responseMimeType: 'text/plain' }
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

// --- Task 4: External Metrics and Safety ---
export interface RewardMetrics {
  latencyMs?: number;
  webSearchSuccess?: boolean;
  safetyFilters?: any;
}

/**
 * Main reward calculation function that combines all components
 */
export async function calcReward(
  observation: any,
  action: any,
  metrics?: RewardMetrics
): Promise<number> {
  // Safety filter: if present, force negative reward
  if (metrics?.safetyFilters && metrics.safetyFilters.length > 0) {
    if (!observation.info) observation.info = {};
    observation.info.safetyViolation = true;
    return -1;
  }
  // Calculate individual reward components
  const userRewardValue = await userFeedbackReward(observation, action);
  const relevanceRewardValue = await relevanceReward(observation, action);
  const explorationRewardValue = explorationReward(observation, action);
  // External metrics
  let latencyPenalty = 0;
  if (typeof metrics?.latencyMs === 'number') {
    latencyPenalty = -0.01 * (metrics.latencyMs / 1000);
  }
  let webSearchBonus = 0;
  if (metrics?.webSearchSuccess) {
    webSearchBonus = 0.05;
  }
  // Weights for different reward components
  const weights = {
    user: 0.5,       // User feedback is highest priority
    relevance: 0.4,  // Relevance is important but secondary
    exploration: 0.1 // Small weight for exploration to encourage diversity
  };
  let totalReward =
    weights.user * userRewardValue +
    weights.relevance * relevanceRewardValue +
    weights.exploration * explorationRewardValue +
    latencyPenalty +
    webSearchBonus;
  
  // Log reward components for debugging
  console.log({
    user: userRewardValue,
    relevance: relevanceRewardValue,
    exploration: explorationRewardValue,
    latencyPenalty,
    webSearchBonus,
    total: totalReward
  });
    
  return totalReward;
} 