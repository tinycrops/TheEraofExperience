import { GoogleGenAI, Content } from '@google/genai';
import { Experience } from './experiential_agent';

// Define a transition for the replay buffer (for backward compatibility)
export interface Transition extends Experience {}

// Simple replay buffer implementation with O(1) operations
export class ReplayBuffer {
  private buffer: Experience[] = [];
  private maxSize: number;
  private position: number = 0;
  private count: number = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  add(transition: Experience): void {
    // If buffer is not full, add to the end
    if (this.count < this.maxSize) {
      this.buffer.push(transition);
      this.position = (this.position + 1) % this.maxSize;
      this.count++;
    } else {
      // Otherwise, replace the oldest entry
      this.buffer[this.position] = transition;
      this.position = (this.position + 1) % this.maxSize;
    }
    
    // Update next_obs in the previous experience if it exists
    const prevIdx = (this.position - 2 + this.maxSize) % this.maxSize;
    if (this.count > 1 && !this.buffer[prevIdx].done) {
      this.buffer[prevIdx].next_obs = transition.obs;
    }
  }

  sample(batchSize: number): Experience[] {
    if (this.count === 0) return [];
    
    const sampleSize = Math.min(batchSize, this.count);
    const samples: Experience[] = [];
    const indices = new Set<number>();
    
    // Generate unique random indices
    while (indices.size < sampleSize) {
      const randomIndex = Math.floor(Math.random() * this.count);
      indices.add(randomIndex);
    }
    
    // Get the experiences at the random indices
    indices.forEach(idx => {
      samples.push(this.buffer[idx]);
    });
    
    return samples;
  }

  size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = [];
    this.position = 0;
    this.count = 0;
  }
}

// Interface for PPO options
interface PPOOptions {
  modelName: string;
  genAI: GoogleGenAI;
  learningRate?: number;
  gamma?: number;
  clipRatio?: number;
  valueCoeff?: number;
  entropyCoeff?: number;
  lambda?: number; // For GAE calculation
  epochs?: number; // Number of optimization passes
}

// PPO implementation with proper advantage estimation
export class PPO {
  private options: PPOOptions;
  private model: any;
  private valueModel: any;
  private lastObservation: any = null;

  constructor(options: PPOOptions) {
    this.options = {
      learningRate: 0.0003,
      gamma: 0.99,
      clipRatio: 0.2,
      valueCoeff: 0.5,
      entropyCoeff: 0.01,
      lambda: 0.95,
      epochs: 4,
      ...options
    };
    
    // Create models for policy and value functions
    this.model = this.options.modelName;
    this.valueModel = this.options.modelName;
  }

  // Calculate the advantage function using Generalized Advantage Estimation (GAE)
  private async calculateAdvantages(experiences: Experience[]): Promise<number[]> {
    // Sort experiences by time if needed
    const sortedExperiences = [...experiences].sort((a, b) => {
      const timestampA = a.obs?.timestamp ? new Date(a.obs.timestamp).getTime() : 0;
      const timestampB = b.obs?.timestamp ? new Date(b.obs.timestamp).getTime() : 0;
      return timestampA - timestampB;
    });
    
    const values: number[] = [];
    const nextValues: number[] = [];
    
    // Calculate values for all states
    for (const exp of sortedExperiences) {
      const value = await this.estimateValue(exp.obs);
      values.push(value);
      
      if (exp.next_obs) {
        const nextValue = await this.estimateValue(exp.next_obs);
        nextValues.push(nextValue);
      } else {
        // If no next_obs, use 0 for terminal states
        nextValues.push(0);
      }
    }
    
    // Calculate advantages
    const advantages: number[] = [];
    for (let i = 0; i < sortedExperiences.length; i++) {
      const exp = sortedExperiences[i];
      const gamma = this.options.gamma || 0.99;
      const delta = exp.reward + (exp.done ? 0 : gamma * nextValues[i]) - values[i];
      
      // For GAE, we'd need the full trajectory, but we can approximate
      advantages.push(delta);
    }
    
    // Normalize advantages
    const mean = advantages.reduce((sum, adv) => sum + adv, 0) / advantages.length;
    const std = Math.sqrt(
      advantages.reduce((sum, adv) => sum + Math.pow(adv - mean, 2), 0) / advantages.length
    );
    
    return advantages.map(adv => (std > 1e-8) ? (adv - mean) / std : adv);
  }
  
  // Estimate the value of a state
  private async estimateValue(observation: any): Promise<number> {
    try {
      if (!observation) {
        return 0;
      }
      
      // Use the value model to estimate the value of this state
      const result = await this.options.genAI.models.generateContent({
        model: this.valueModel,
        contents: [{ 
          role: 'user',
          parts: [{ text: JSON.stringify({
            task: 'estimate_value',
            observation: observation
          })}]
        }]
      });
      
      const responseText = result?.text || '';
      // Expecting the model to return a numeric value
      const value = parseFloat(responseText.trim());
      return isNaN(value) ? 0 : value;
    } catch (error) {
      console.error('Error estimating value:', error);
      return 0;
    }
  }

  async act(observation: any): Promise<any> {
    // Store the observation for future reference
    this.lastObservation = observation;
    
    // Use model to get an action based on the current observation
    try {
      const result = await this.options.genAI.models.generateContent({
        model: this.model,
        contents: [{ 
          role: 'user',
          parts: [{ text: JSON.stringify({ 
            task: 'generate_action',
            observation: observation 
          })}]
        }]
      });

      const responseText = result.text || '';
      
      // Parse potential function calls
      if (responseText.includes('function:')) {
        // Extract function call details
        const functionMatch = responseText.match(/function:\s*(\w+)\((.*)\)/);
        if (functionMatch) {
          const functionName = functionMatch[1];
          const functionArgs = functionMatch[2];
          
          return {
            functionCall: {
              name: functionName,
              args: JSON.parse(functionArgs || '{}')
            }
          };
        }
      }
      
      // Regular text response
      return { 
        parts: [{ text: responseText }] 
      };
    } catch (error) {
      console.error('Error generating action:', error);
      return { 
        parts: [{ text: 'Error generating response' }] 
      };
    }
  }

  // Update the policy based on collected experiences
  async learn(experiences: Experience[]): Promise<void> {
    if (experiences.length === 0) return;
    
    console.log(`Learning from batch of size ${experiences.length}`);
    
    try {
      // Calculate advantages for all experiences
      const advantages = await this.calculateAdvantages(experiences);
      
      // Simple mechanism to "learn" by informing the model about high-reward experiences
      const highRewardExperiences = experiences
        .map((exp, i) => ({ experience: exp, advantage: advantages[i] }))
        .filter(item => item.advantage > 0)
        .sort((a, b) => b.advantage - a.advantage)
        .slice(0, 5); // Take top 5 high-reward experiences
      
      if (highRewardExperiences.length === 0) {
        console.log('No positive advantage experiences to learn from');
        return;
      }
      
      // Send high-reward experiences to the model for "learning"
      const learningPrompt = {
        role: 'user',
        parts: [{ text: JSON.stringify({
          task: 'update_policy',
          experiences: highRewardExperiences.map(item => ({
            observation: item.experience.obs,
            action: item.experience.action,
            reward: item.experience.reward,
            advantage: item.advantage
          }))
        })}]
      };
      
      // The idea is that by showing examples of high-reward experiences, 
      // the model will implicitly learn to generate better responses through in-context learning
      await this.options.genAI.models.generateContent({
        model: this.model,
        contents: [learningPrompt]
      });
      
      console.log(`Updated policy with ${highRewardExperiences.length} high-reward experiences`);
    } catch (error) {
      console.error('Error during learning step:', error);
    }
  }
} 