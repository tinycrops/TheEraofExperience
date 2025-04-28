/**
 * ExperienceStream
 *
 * Implements the "Streams" concept from the Era of Experience paper.
 * Enables the agent to maintain a continuous stream of experience over time,
 * rather than isolated episodes. This allows for long-term goals, adaptation,
 * and learning over extended periods.
 */
import { Experience } from './experiential_agent';
import { WorldModel } from './world_model';
import { VectorMemory } from './memory';
export declare enum StreamState {
    ACTIVE = "active",// Stream is currently active and receiving new experiences
    PAUSED = "paused",// Stream is temporarily paused
    COMPLETED = "completed",// Stream has completed its goal
    ABANDONED = "abandoned"
}
export interface Goal {
    id: string;
    description: string;
    target?: any;
    metrics: {
        [key: string]: {
            current: number;
            target: number;
            weight: number;
            baseline?: number;
        };
    };
    timeframe?: {
        start: Date;
        deadline?: Date;
    };
    priority: number;
    completedAt?: Date;
}
/**
 * ExperienceStream manages a continuous stream of agent experiences
 * toward accomplishing long-term goals
 */
export declare class ExperienceStream {
    private streamId;
    private experiences;
    private goals;
    private state;
    private worldModel;
    private memory;
    private createdAt;
    private lastUpdatedAt;
    constructor(streamId: string, worldModel: WorldModel, memory: VectorMemory);
    /**
     * Add a new experience to the stream
     */
    addExperience(experience: Experience): Promise<void>;
    /**
     * Add a new goal to the stream
     */
    addGoal(goal: Goal): void;
    /**
     * Update a goal's metrics based on new experience
     */
    private updateGoalProgress;
    /**
     * Calculate progress toward a specific goal (0-1)
     */
    calculateGoalProgress(goal: Goal): number;
    /**
     * Get recent experiences from the stream
     */
    getRecentExperiences(limit?: number): Experience[];
    /**
     * Get all goals with their current progress
     */
    getGoalsWithProgress(): Array<Goal & {
        progress: number;
    }>;
    /**
     * Look back at past experiences to extract insights
     */
    analyzeExperienceHistory(): Promise<any>;
    /**
     * Save stream data to disk
     */
    private saveToDisk;
    /**
     * Load stream data from disk
     */
    private loadFromDisk;
    /**
     * Get stream status summary
     */
    getStatus(): any;
}
/**
 * Factory function to create or load an experience stream
 */
export declare function getExperienceStream(streamId: string, worldModel: WorldModel, memory: VectorMemory): Promise<ExperienceStream>;
