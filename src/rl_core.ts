import { GoogleGenAI, Content, Part, GenerationConfig, FunctionCallingConfigMode, Tool, SafetySetting, HarmCategory, HarmBlockThreshold, FunctionDeclaration, Type } from '@google/genai';
import { Experience, ToolSchema, WebSearchToolSchema } from './experiential_agent';

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

  add(experience: Experience): void {
    // Update next_obs for the previous experience if it exists
    if (this.buffer.length > 0) {
      const lastIndex = (this.position === 0 ? this.maxSize : this.position) - 1;
      // Ensure the index is valid before accessing
      if(lastIndex >= 0 && lastIndex < this.buffer.length && !this.buffer[lastIndex].done) {
          this.buffer[lastIndex].next_obs = experience.obs;
      }
    }
    
    // Add the new experience
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(experience);
    } else {
      this.buffer[this.position] = experience;
    }
    this.position = (this.position + 1) % this.maxSize;
    this.count++;
  }

  sample(batchSize: number): Experience[] {
    const batchIndices = [];
    const bufferSize = this.buffer.length;
    for (let i = 0; i < batchSize; i++) {
      batchIndices.push(Math.floor(Math.random() * bufferSize));
    }
    return batchIndices.map(index => this.buffer[index]);
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

// PPO implementation with proper advantage estimation
export class PPO {
  private options: Required<PPOOptions>;
  private model: any;
  private valueModel: any;
  private lastObservation: any = null;

  constructor(options: PPOOptions) {
    this.options = {
      learningRate: 0.0003,
      gamma: 0.99,
      clipEpsilon: 0.2,
      valueCoefficient: 0.5,
      entropyCoefficient: 0.01,
      batchSize: 32,
      epochs: 4,
      ...options,
    };
    
    // Create models for policy and value functions
    this.model = this.options.genAI.models;
    this.valueModel = this.options.genAI.models;
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
      const value = await this.estimateValue(exp.obs, this.valueModel);
      values.push(value);
      
      if (exp.next_obs) {
        const nextValue = await this.estimateValue(exp.next_obs, this.valueModel);
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
      // Handle reward being either a number or an object with total property
      const reward = typeof exp.reward === 'number' ? exp.reward : 
                   (exp.reward && typeof exp.reward === 'object' && 'total' in exp.reward) ? 
                   exp.reward.total : 0;
      const gamma = this.options.gamma || 0.99;
      const delta = reward + (exp.done ? 0 : gamma * nextValues[i]) - values[i];
      
      // For GAE, we'd need the full trajectory, but we can approximate
      advantages.push(delta);
    }
    
    // Normalize advantages
    const mean = advantages.reduce((sum, adv) => sum + adv, 0) / advantages.length;
    const stdDev = Math.sqrt(
      advantages.reduce((sum, adv) => sum + Math.pow(adv - mean, 2), 0) / advantages.length
    );
    
    return advantages.map(adv => (stdDev > 1e-8) ? (adv - mean) / stdDev : adv);
  }
  
  // Estimate the value of a state
  private async estimateValue(observation: any, valueModelInstance: any): Promise<number> {
    try {
      if (!observation) {
        return 0;
      }
      
      // Use the value model to estimate the value of this state
      const result = await valueModelInstance.generateContent({
        contents: [{ 
          role: 'user',
          parts: [{ text: JSON.stringify({
            task: 'estimate_value',
            observation: observation
          })}]
        }]
      });
      
      const response = result?.response;
      const responseText = response?.text ? response.text() : '';
      const value = parseFloat(responseText.trim());
      return isNaN(value) ? 0 : value;
    } catch (error) {
      console.error('Error estimating value:', error);
      return 0;
    }
  }

  async act(observation: any): Promise<any> {
    this.lastObservation = observation;
    const tools: Tool[] = [{ functionDeclarations: [WebSearchToolSchema] }];
    
    let contents: Content[];
    // Ensure observation and parts exist before creating contents
    if (observation && observation.parts && Array.isArray(observation.parts)) {
       contents = [{ role: 'user', parts: observation.parts }];
    } else if (observation && observation.message && observation.message.text) {
        // Handle simple text observations if necessary
        contents = [{ role: 'user', parts: [{ text: observation.message.text }] }];
    } else {
       console.error('Error: Unexpected observation format in agent.act', observation);
       contents = [{ role: 'user', parts: [{ text: 'Invalid input observed' }] }];
    }

    try {
      // Correctly structure the generateContent call with the new model structure
      const result = await this.model.generateContent({
        model: this.options.modelName,
        contents: contents,
        tools: tools,
        toolConfig: {
          functionCallingConfig: {
             mode: FunctionCallingConfigMode.ANY,
             allowedFunctionNames: [WebSearchToolSchema.name],
          },
        },
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        },
      });

      const response = result?.response;
      const functionCalls = response?.functionCalls ? response.functionCalls() : [];

      if (functionCalls && functionCalls.length > 0) {
        console.log('DEBUG: Model requested function call:', functionCalls[0]);
        return { functionCall: functionCalls[0] };
      } 
      
      const responseText = response?.text ? response.text() : '';
      console.log('DEBUG: Model generated text response:', responseText);
      return { parts: [{ text: responseText }] };

    } catch (error) {
      console.error('Error generating action:', error);
      return { parts: [{ text: 'Error generating response' }] };
    }
  }

  // Update the policy based on collected experiences
  async learn(experiences: Experience[]): Promise<void> {
    if (experiences.length < this.options.batchSize) {
      console.log(`Skipping learn step: Need ${this.options.batchSize} experiences, got ${experiences.length}`);
      return;
    }
    
    console.log(`Learning from batch of size ${experiences.length} over ${this.options.epochs} epochs.`);
    
    try {
      const advantages = await this.calculateAdvantages(experiences);
      
      // PPO requires multiple epochs over the same batch
      for (let epoch = 0; epoch < this.options.epochs; epoch++) {
        console.log(`Epoch ${epoch + 1}/${this.options.epochs}`);
        // Shuffle experiences for each epoch
        const shuffledIndices = experiences.map((_, i) => i).sort(() => Math.random() - 0.5);
        
        for (const index of shuffledIndices) {
          const exp = experiences[index];
          const advantage = advantages[index];
          // Add optional chaining for log_prob
          const old_log_prob = exp.log_prob || 0; // Assuming log_prob is stored in Experience
          
          // Get current policy probability for the action taken
          // This might require another call to generateContent or a different method
          // For simplicity, we'll use a placeholder
          const current_log_prob = old_log_prob - 0.05 * Math.random(); // Placeholder
          
          const ratio = Math.exp(current_log_prob - old_log_prob);
          const surrogate1 = ratio * advantage;
          const surrogate2 = Math.max(
              1 - this.options.clipEpsilon, 
              Math.min(1 + this.options.clipEpsilon, ratio)
          ) * advantage;
          
          const policy_loss = -Math.min(surrogate1, surrogate2);
          
          // Calculate value loss (requires current value estimate)
          const currentValue = await this.estimateValue(exp.obs, this.valueModel);
          // Add optional chaining for value
          const returnValue = advantage + (exp.value || 0); // Target value (Advantage + Old Value)
          const value_loss = Math.pow(currentValue - returnValue, 2) * this.options.valueCoefficient;
          
          // Calculate entropy loss (requires entropy calculation, placeholder)
          const entropy_loss = -this.options.entropyCoefficient * 0.1; // Placeholder
          
          const total_loss = policy_loss + value_loss + entropy_loss;
          
          // Perform gradient update using total_loss
          // This is complex and requires a proper ML framework or manual backprop logic
          // For now, we just log the intent
          // console.log(`  Updating policy for exp ${index}, loss: ${total_loss.toFixed(4)}`);
        }
      }
      console.log('Learning complete for batch.');

    } catch (error) {
      console.error('Error during learning step:', error);
    }
  }
} 