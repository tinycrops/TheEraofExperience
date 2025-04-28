import { GoogleGenAI } from '@google/genai';
import { Experience } from './experiential_agent';
import { VectorMemory } from './memory';
/**
 * World Model for predicting the consequences of actions
 *
 * The world model learns to predict:
 * 1. How the environment will respond to actions
 * 2. What reward signals will result from actions
 * 3. How observations will change over time
 */
export declare class WorldModel {
    private modelName;
    private genAI;
    private memory;
    constructor(genAI: GoogleGenAI, memory: VectorMemory, modelName?: string);
    /**
     * Predict the next observation and reward given a current observation and proposed action
     */
    predictNextState(observation: any, proposedAction: any): Promise<{
        predictedObs: any;
        predictedReward: number;
        confidence: number;
    }>;
    /**
     * Plan a sequence of actions to maximize expected reward
     * Implements a simple lookahead planning algorithm
     */
    planActions(observation: any, possibleActions: any[], depth?: number): Promise<any[]>;
    /**
     * Update the world model based on actual experience
     */
    update(experience: Experience): Promise<void>;
}
