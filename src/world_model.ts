import { GoogleGenAI, Content, Type } from '@google/genai';
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
export class WorldModel {
  private modelName: string;
  private genAI: GoogleGenAI;
  private memory: VectorMemory;
  
  constructor(genAI: GoogleGenAI, memory: VectorMemory, modelName: string = 'gemini-2.0-flash') {
    this.genAI = genAI;
    this.memory = memory;
    this.modelName = modelName;
  }
  
  /**
   * Predict the next observation and reward given a current observation and proposed action
   */
  async predictNextState(observation: any, proposedAction: any): Promise<{
    predictedObs: any,
    predictedReward: number,
    confidence: number
  }> {
    try {
      // Retrieve similar past experiences to inform the prediction
      const queryText = JSON.stringify({
        observation: observation,
        action: proposedAction,
      });
      
      const similarExperiences = await this.memory.querySimilar(queryText, 5);
      
      // Format past experiences for the model
      const pastExamplesText = similarExperiences.map(entry => {
        try {
          const data = JSON.parse(entry.text);
          return `Observation: ${JSON.stringify(data.observation)}\nAction: ${JSON.stringify(data.action)}\nResult: ${JSON.stringify(data.next_obs)}\nReward: ${data.reward}`;
        } catch (e) {
          return entry.text;
        }
      }).join('\n\n');
      
      // Create prompt for the prediction
      const contents: Content[] = [{
        role: 'user',
        parts: [{ text: `You are a world model that predicts the next state and reward.

Past similar experiences:
${pastExamplesText}

Current observation:
${JSON.stringify(observation, null, 2)}

Proposed action:
${JSON.stringify(proposedAction, null, 2)}

Predict what will happen next, including the next observation and expected reward. 
Format your response as a JSON object with this structure:
{
  "predictedObs": { ... detailed prediction of the next observation ... },
  "predictedReward": number, // expected reward from -1.0 to 1.0
  "confidence": number, // your confidence in this prediction from 0.0 to 1.0
  "reasoning": "string explaining your prediction"
}
`}]
      }];
      
      // Get prediction from model
      const model = this.genAI.models;
      const result = await model.generateContent({
        model: this.modelName,
        contents,
        config: {
          temperature: 0.2, // Low temperature for more deterministic predictions
          topP: 0.8,
          topK: 40
        }
      });
      
      // Parse the response
      const responseText = result.text || '';
      let response;
      
      try {
        // Extract JSON object from text response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
        response = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Error parsing world model response:', e);
        console.log('Raw response:', responseText);
        return {
          predictedObs: observation,
          predictedReward: 0,
          confidence: 0
        };
      }
      
      // If predictedObs is a string, try to parse it as JSON
      let predictedObservation = response.predictedObs;
      if (typeof predictedObservation === 'string') {
        try {
          predictedObservation = JSON.parse(predictedObservation);
        } catch (e) {
          // If parsing fails, keep it as a string
          console.log('Could not parse predictedObs as JSON, keeping as string');
        }
      }
      
      return {
        predictedObs: predictedObservation,
        predictedReward: response.predictedReward,
        confidence: response.confidence
      };
    } catch (error) {
      console.error('Error in world model prediction:', error);
      // Return a default prediction if there's an error
      return {
        predictedObs: observation,
        predictedReward: 0,
        confidence: 0
      };
    }
  }
  
  /**
   * Plan a sequence of actions to maximize expected reward
   * Implements a simple lookahead planning algorithm
   */
  async planActions(observation: any, possibleActions: any[], depth: number = 2): Promise<any[]> {
    if (depth <= 0 || possibleActions.length === 0) {
      return [];
    }
    
    const plans: Array<{
      actions: any[];
      totalReward: number;
      confidence: number;
    }> = [];
    
    // Evaluate each possible first action
    for (const action of possibleActions) {
      try {
        // Predict the outcome of taking this action
        const prediction = await this.predictNextState(observation, action);
        
        // If this is the last step in our planning horizon, just use this action
        if (depth === 1) {
          plans.push({
            actions: [action],
            totalReward: prediction.predictedReward,
            confidence: prediction.confidence
          });
        } else {
          // Otherwise, recursively plan from the predicted next state
          const futurePlan = await this.planActions(
            prediction.predictedObs, 
            possibleActions, 
            depth - 1
          );
          
          // Calculate the expected discounted future reward
          const futureReward = futurePlan.reduce((sum, action, i) => {
            // Apply discount factor to future rewards (0.9^i)
            return sum + (0.9 ** i) * action.predictedReward;
          }, 0);
          
          plans.push({
            actions: [action, ...futurePlan],
            totalReward: prediction.predictedReward + 0.9 * futureReward,
            confidence: prediction.confidence
          });
        }
      } catch (error) {
        console.error('Error in planning step:', error);
      }
    }
    
    // Sort plans by expected reward, weighted by confidence
    plans.sort((a, b) => 
      (b.totalReward * b.confidence) - (a.totalReward * a.confidence)
    );
    
    // Return the actions from the best plan, or an empty array if no plans were created
    return plans.length > 0 ? plans[0].actions : [];
  }
  
  /**
   * Update the world model based on actual experience
   */
  async update(experience: Experience): Promise<void> {
    // Store the experience in vector memory for future predictions
    const experienceText = JSON.stringify({
      observation: experience.obs,
      action: experience.action,
      next_obs: experience.next_obs,
      reward: experience.reward
    });
    
    await this.memory.addMemory(experienceText, {
      sessionId: experience.sessionId,
      timestamp: new Date().toISOString()
    });
  }
}