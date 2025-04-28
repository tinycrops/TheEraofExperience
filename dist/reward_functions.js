"use strict";
/**
 * Reward functions for the experiential agent
 *
 * This module implements reward functions to guide the agent's learning based on multiple
 * signals: user feedback, relevance scoring, and exploration bonuses.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.userFeedbackReward = userFeedbackReward;
exports.relevanceReward = relevanceReward;
exports.explorationReward = explorationReward;
exports.calcReward = calcReward;
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv-flow"));
const path = __importStar(require("path"));
// Load environment variables - explicitly include .env.local
dotenv.config({
    path: path.resolve(process.cwd()),
    node_env: process.env.NODE_ENV || 'development',
    default_node_env: 'development',
});
// Global state to track exploration
const explorationTracking = {
    observedStates: new Set(),
    actionCounts: new Map()
};
// Initialize the Gemini model for relevance evaluation
let evaluationModel = 'gemini-2.0-flash';
let genAI = null;
function getEvaluationModel() {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required for reward evaluation');
        }
        genAI = new genai_1.GoogleGenAI({ apiKey });
    }
    return { genAI, model: evaluationModel };
}
// Function to extract hash key from observation for tracking exploration
function getStateHash(observation) {
    if (typeof observation?.message?.text === 'string') {
        // Use first 100 chars of message as unique identifier
        return observation.message.text.slice(0, 100);
    }
    // Fallback to timestamp if no text
    return observation.timestamp || Date.now().toString();
}
// Function to extract hash key from action
function getActionHash(action) {
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
/**
 * Calculate reward based on user feedback (thumbs up/down)
 * In a real application, this would track actual user feedback
 */
async function userFeedbackReward(observation, action) {
    // In a real implementation, this would use actual user feedback
    // For now, we'll simulate with a mock implementation
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
async function relevanceReward(observation, action) {
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
      ` }]
        };
        // Get evaluation from model
        const result = await genAI.models.generateContent({
            model,
            contents: [evaluationPrompt]
        });
        const scoreText = result.text?.trim() || '';
        const score = parseFloat(scoreText);
        if (isNaN(score) || score < 0 || score > 1) {
            console.warn('Invalid relevance score:', scoreText);
            return 0.5; // Fallback to neutral score
        }
        return score;
    }
    catch (error) {
        console.error('Error calculating relevance reward:', error);
        return 0.5; // Fallback to neutral score
    }
}
/**
 * Calculate reward for exploration to encourage diverse behavior
 */
function explorationReward(observation, action) {
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
/**
 * Main reward calculation function that combines all components
 */
async function calcReward(observation, action) {
    // Calculate individual reward components
    const userRewardValue = await userFeedbackReward(observation, action);
    const relevanceRewardValue = await relevanceReward(observation, action);
    const explorationRewardValue = explorationReward(observation, action);
    // Weights for different reward components
    const weights = {
        user: 0.5, // User feedback is highest priority
        relevance: 0.4, // Relevance is important but secondary
        exploration: 0.1 // Small weight for exploration to encourage diversity
    };
    // Calculate weighted sum of rewards
    const totalReward = weights.user * userRewardValue +
        weights.relevance * relevanceRewardValue +
        weights.exploration * explorationRewardValue;
    // Log reward components for debugging
    console.log({
        user: userRewardValue,
        relevance: relevanceRewardValue,
        exploration: explorationRewardValue,
        total: totalReward
    });
    return totalReward;
}
