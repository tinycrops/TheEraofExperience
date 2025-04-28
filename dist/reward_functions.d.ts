/**
 * Reward functions for the experiential agent
 *
 * This module implements reward functions to guide the agent's learning based on multiple
 * signals: user feedback, relevance scoring, and exploration bonuses.
 */
export declare function persistUserRating(sessionId: string, rating: number): void;
/**
 * Calculate reward based on user feedback (thumbs up/down)
 * This is a grounded reward based on actual user responses
 */
export declare function userFeedbackReward(observation: any, action: any): Promise<number>;
/**
 * Calculate reward based on relevance to query using a Gemini evaluator
 */
export declare function relevanceReward(observation: any, action: any): Promise<number>;
/**
 * Calculate reward for exploration to encourage diverse behavior
 */
export declare function explorationReward(observation: any, action: any): number;
/**
 * Measure information gain based on dialogue history
 * This assesses if the agent is helping the user expand their knowledge
 */
export declare function informationGainReward(observation: any, action: any): number;
/**
 * External task completion/goal achievement reward
 * This measures success at accomplishing concrete tasks
 */
export declare function taskCompletionReward(observation: any, action: any, metrics?: RewardMetrics): number;
/**
 * Long-term user engagement reward
 * This measures if the agent is maintaining engagement over time
 */
export declare function userEngagementReward(observation: any, metrics?: RewardMetrics): number;
export interface RewardMetrics {
    latencyMs?: number;
    webSearchSuccess?: boolean;
    safetyFilters?: any;
    taskCompleted?: boolean;
    sessionDuration?: number;
    userInteractions?: number;
    learningProgress?: number;
    healthMetrics?: {
        stepsIncreased?: boolean;
        sleepImproved?: boolean;
        heartRateImproved?: boolean;
        [key: string]: any;
    };
    [key: string]: any;
}
/**
 * Main reward calculation function that combines all components
 */
export declare function calcReward(observation: any, action: any, metrics?: RewardMetrics): Promise<{
    total: number;
    breakdown: Record<string, number>;
}>;
