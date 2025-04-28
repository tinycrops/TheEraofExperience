/**
 * Experiential Planning
 *
 * This module implements the Planning and Reasoning principles from The Era of Experience paper.
 * Rather than just reasoning with language, the agent plans by predicting the concrete consequences
 * of its actions on the world, including future observations and rewards.
 */
import { GoogleGenAI } from '@google/genai';
import { WorldModel } from './world_model';
import { Goal } from './experience_stream';
import { VectorMemory } from './memory';
import { Experience } from './experiential_agent';
export interface Plan {
    goal: Goal;
    steps: PlanStep[];
    estimatedReward: number;
    confidence: number;
    timeframe: {
        start: Date;
        estimatedCompletion: Date;
    };
}
export interface PlanStep {
    action: any;
    predictedObs: any;
    predictedReward: number;
    confidence: number;
    completed: boolean;
    actualObs?: any;
    actualReward?: number | {
        total: number;
        [key: string]: any;
    };
    explanations?: string;
}
/**
 * ExperientialPlanner uses the world model to plan sequences of actions
 * oriented toward achieving specific goals
 */
export declare class ExperientialPlanner {
    private worldModel;
    private genAI;
    private memory;
    private modelName;
    constructor(genAI: GoogleGenAI, worldModel: WorldModel, memory: VectorMemory, modelName?: string);
    /**
     * Generate a plan to achieve a goal
     */
    createPlan(currentObservation: any, goal: Goal, possibleActions: any[], maxSteps?: number, searchDepth?: number): Promise<Plan>;
    /**
     * Find the best next action using lookahead search
     */
    private findBestNextAction;
    /**
     * Evaluate how a state contributes to goal progress (0-1)
     */
    private evaluateGoalProgress;
    /**
     * Update a plan with actual outcomes after an action is taken
     */
    updatePlan(plan: Plan, stepIndex: number, actualExperience: Experience): Promise<Plan>;
    /**
     * Determine if we need to replan based on deviation from predictions
     */
    private shouldReplan;
    /**
     * Generate potential actions based on current observation and goal
     */
    generatePotentialActions(observation: any, goal: Goal, actionTypes?: string[]): Promise<any[]>;
    /**
     * Explain a plan in natural language
     */
    explainPlan(plan: Plan): Promise<string>;
}
