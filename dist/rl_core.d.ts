import { GoogleGenAI } from '@google/genai';
import { Experience } from './experiential_agent';
export interface Transition extends Experience {
}
export declare class ReplayBuffer {
    private buffer;
    private maxSize;
    private position;
    private count;
    constructor(maxSize: number);
    add(experience: Experience): void;
    sample(batchSize: number): Experience[];
    size(): number;
    clear(): void;
}
export interface PPOOptions {
    modelName: string;
    genAI: GoogleGenAI;
    learningRate?: number;
    gamma?: number;
    clipEpsilon?: number;
    valueCoefficient?: number;
    entropyCoefficient?: number;
    batchSize?: number;
    epochs?: number;
}
export declare class PPO {
    private options;
    private model;
    private valueModel;
    private lastObservation;
    constructor(options: PPOOptions);
    private calculateAdvantages;
    private estimateValue;
    act(observation: any): Promise<any>;
    learn(experiences: Experience[]): Promise<void>;
}
